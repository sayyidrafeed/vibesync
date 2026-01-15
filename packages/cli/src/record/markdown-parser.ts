/**
 * Markdown Parser Module
 * 
 * Provides utilities for parsing and manipulating markdown files,
 * specifically designed for task lists and spec documents.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Represents a task item in a markdown task list
 */
export interface TaskItem {
    line: number;           // 1-indexed line number
    indent: number;         // Indentation level (0 = top-level)
    status: 'unchecked' | 'in-progress' | 'checked';
    text: string;           // Task text without the checkbox
    rawLine: string;        // Original line content
}

/**
 * Represents a section in a markdown document
 */
export interface MarkdownSection {
    title: string;
    level: number;          // Heading level (1-6)
    startLine: number;      // Line where section starts (1-indexed)
    endLine: number;        // Line where section ends
    content: string;        // Section content (excluding heading)
}

/**
 * Parse task items from markdown content
 * Supports: - [ ] unchecked, - [/] in-progress, - [x] checked
 */
export function parseTaskItems(content: string): TaskItem[] {
    const lines = content.split('\n');
    const tasks: TaskItem[] = [];

    // Regex to match task list items
    // Captures: indent, checkbox content, task text
    const taskRegex = /^(\s*)[-*]\s*\[([ x/])\]\s*(.+)$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(taskRegex);

        if (match) {
            const [, indent, checkbox, text] = match;
            const indentLevel = Math.floor(indent.length / 4); // 4 spaces = 1 level

            let status: TaskItem['status'];
            if (checkbox === ' ') {
                status = 'unchecked';
            } else if (checkbox.toLowerCase() === 'x') {
                status = 'checked';
            } else if (checkbox === '/') {
                status = 'in-progress';
            } else {
                status = 'unchecked';
            }

            tasks.push({
                line: i + 1,
                indent: indentLevel,
                status,
                text: text.trim(),
                rawLine: line,
            });
        }
    }

    return tasks;
}

/**
 * Parse sections from markdown content
 */
export function parseSections(content: string): MarkdownSection[] {
    const lines = content.split('\n');
    const sections: MarkdownSection[] = [];

    // Regex to match headings
    const headingRegex = /^(#{1,6})\s+(.+)$/;

    let currentSection: MarkdownSection | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(headingRegex);

        if (match) {
            // Close previous section
            if (currentSection) {
                currentSection.endLine = i; // Previous line
                currentSection.content = lines
                    .slice(currentSection.startLine, i)
                    .join('\n')
                    .trim();
                sections.push(currentSection);
            }

            const [, hashes, title] = match;
            currentSection = {
                title: title.trim(),
                level: hashes.length,
                startLine: i + 2, // Line after heading (1-indexed)
                endLine: lines.length, // Default to end
                content: '',
            };
        }
    }

    // Close last section
    if (currentSection) {
        currentSection.endLine = lines.length;
        currentSection.content = lines
            .slice(currentSection.startLine - 1)
            .join('\n')
            .trim();
        sections.push(currentSection);
    }

    return sections;
}

/**
 * Update a task item's status in the markdown content
 */
export function updateTaskStatus(
    content: string,
    lineNumber: number,
    newStatus: TaskItem['status']
): string {
    const lines = content.split('\n');
    const lineIndex = lineNumber - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
        return content;
    }

    const line = lines[lineIndex];
    const taskRegex = /^(\s*[-*]\s*\[)([ x/])(\]\s*.+)$/i;
    const match = line.match(taskRegex);

    if (!match) {
        return content;
    }

    const [, prefix, , suffix] = match;
    let statusChar: string;

    switch (newStatus) {
        case 'checked':
            statusChar = 'x';
            break;
        case 'in-progress':
            statusChar = '/';
            break;
        default:
            statusChar = ' ';
    }

    lines[lineIndex] = `${prefix}${statusChar}${suffix}`;
    return lines.join('\n');
}

/**
 * Append content to a specific section
 */
export function appendToSection(
    content: string,
    sectionTitle: string,
    newContent: string
): string {
    const sections = parseSections(content);
    const section = sections.find(
        (s) => s.title.toLowerCase() === sectionTitle.toLowerCase()
    );

    if (!section) {
        // Section not found, append at end with new section
        return `${content}\n\n## ${sectionTitle}\n\n${newContent}\n`;
    }

    const lines = content.split('\n');

    // Find the end of this section's content (before next section or EOF)
    let insertLine = section.endLine;

    // Insert the new content
    lines.splice(insertLine, 0, '', newContent);

    return lines.join('\n');
}

/**
 * Append content at the end of the file
 */
export function appendToFile(content: string, newContent: string): string {
    return `${content.trimEnd()}\n\n${newContent}\n`;
}

/**
 * Calculate similarity between two strings (simple word overlap)
 * Returns a score between 0 and 1
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const normalize = (s: string) =>
        s.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 2); // Ignore short words

    const words1 = new Set(normalize(str1));
    const words2 = new Set(normalize(str2));

    if (words1.size === 0 || words2.size === 0) {
        return 0;
    }

    let matches = 0;
    for (const word of words1) {
        if (words2.has(word)) {
            matches++;
        }
    }

    // Jaccard-like similarity
    const union = new Set([...words1, ...words2]);
    return matches / union.size;
}

/**
 * Find tasks that match a given description
 * Uses fuzzy matching to find relevant tasks
 */
export function findMatchingTasks(
    tasks: TaskItem[],
    description: string,
    threshold: number = 0.3
): TaskItem[] {
    return tasks
        .filter((task) => task.status !== 'checked')
        .map((task) => ({
            task,
            score: calculateSimilarity(task.text, description),
        }))
        .filter(({ score }) => score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map(({ task }) => task);
}

/**
 * Read a markdown file safely
 */
export function readMarkdownFile(filePath: string): string | null {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Write content to a markdown file
 */
export function writeMarkdownFile(filePath: string, content: string): boolean {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch {
        return false;
    }
}
