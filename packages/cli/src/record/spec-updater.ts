/**
 * Spec Updater Module
 * 
 * Automatically updates spec.md based on extracted intents.
 * Appends new features, bug fixes, and other changes to the spec document.
 */

import path from 'node:path';
import { logger } from '../utils/logger.js';
import {
    parseSections,
    appendToSection,
    appendToFile,
    readMarkdownFile,
    writeMarkdownFile,
} from './markdown-parser.js';
import type { IntentResponse } from '../lib/llm.js';

const DEFAULT_SPEC_FILE = 'docs/spec.md';

/**
 * Configuration for spec updater
 */
export interface SpecUpdaterConfig {
    specFilePath: string;           // Path to spec.md
    enableAutoUpdate: boolean;      // Auto update spec on intents
    minConfidence: number;          // Minimum confidence to record
}

const DEFAULT_CONFIG: SpecUpdaterConfig = {
    specFilePath: DEFAULT_SPEC_FILE,
    enableAutoUpdate: true,
    minConfidence: 0.5,
};

/**
 * Result of a spec update operation
 */
export interface SpecUpdateResult {
    success: boolean;
    section: string | null;
    message: string;
}

/**
 * Section mapping for different intent categories
 */
const CATEGORY_SECTIONS: Record<IntentResponse['category'], string> = {
    feature: 'Features',
    bugfix: 'Bug Fixes',
    refactor: 'Refactoring',
    docs: 'Documentation',
    config: 'Configuration',
    test: 'Testing',
    other: 'Other Changes',
};

/**
 * Spec Updater class
 * Maintains a living spec.md document based on development activities
 */
export class SpecUpdater {
    private config: SpecUpdaterConfig;
    private cwd: string;

    constructor(cwd: string = process.cwd(), config: Partial<SpecUpdaterConfig> = {}) {
        this.cwd = cwd;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get the full path to the spec file
     */
    getSpecFilePath(): string {
        return path.join(this.cwd, this.config.specFilePath);
    }

    /**
     * Initialize spec.md if it doesn't exist
     */
    initializeSpec(): boolean {
        const specPath = this.getSpecFilePath();
        const content = readMarkdownFile(specPath);

        if (content !== null) {
            return true; // Already exists
        }

        const template = this.generateSpecTemplate();
        const success = writeMarkdownFile(specPath, template);

        if (success) {
            logger.success(`Created spec.md at ${specPath}`);
        }

        return success;
    }

    /**
     * Process an intent and update spec.md
     */
    processIntent(intent: IntentResponse): SpecUpdateResult {
        if (!this.config.enableAutoUpdate) {
            return {
                success: true,
                section: null,
                message: 'Auto-update disabled',
            };
        }

        if (intent.confidence < this.config.minConfidence) {
            return {
                success: true,
                section: null,
                message: `Confidence too low (${intent.confidence} < ${this.config.minConfidence})`,
            };
        }

        const specPath = this.getSpecFilePath();
        let content = readMarkdownFile(specPath);

        // Initialize if doesn't exist
        if (content === null) {
            this.initializeSpec();
            content = readMarkdownFile(specPath);
            if (content === null) {
                return {
                    success: false,
                    section: null,
                    message: 'Failed to create spec.md',
                };
            }
        }

        // Determine the section based on category
        const sectionName = CATEGORY_SECTIONS[intent.category];

        // Format the entry
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const entry = `- **${timestamp}**: ${intent.summary}`;

        // Check for duplicate entries
        if (content.includes(intent.summary)) {
            return {
                success: true,
                section: sectionName,
                message: 'Entry already exists in spec',
            };
        }

        // Append to the appropriate section
        const updatedContent = appendToSection(content, sectionName, entry);

        // Write the updated content
        const written = writeMarkdownFile(specPath, updatedContent);

        if (written) {
            logger.success(`Spec updated: [${sectionName}] ${intent.summary}`);
        }

        return {
            success: written,
            section: sectionName,
            message: written ? `Added to ${sectionName}` : 'Failed to write spec.md',
        };
    }

    /**
     * Add a manual entry to the spec
     */
    addEntry(
        category: IntentResponse['category'],
        description: string
    ): SpecUpdateResult {
        const specPath = this.getSpecFilePath();
        let content = readMarkdownFile(specPath);

        if (content === null) {
            this.initializeSpec();
            content = readMarkdownFile(specPath);
            if (content === null) {
                return {
                    success: false,
                    section: null,
                    message: 'Failed to create spec.md',
                };
            }
        }

        const sectionName = CATEGORY_SECTIONS[category];
        const timestamp = new Date().toISOString().split('T')[0];
        const entry = `- **${timestamp}**: ${description}`;

        const updatedContent = appendToSection(content, sectionName, entry);
        const written = writeMarkdownFile(specPath, updatedContent);

        return {
            success: written,
            section: sectionName,
            message: written ? `Added to ${sectionName}` : 'Failed to write spec.md',
        };
    }

    /**
     * Get all sections from the spec
     */
    getSections(): Array<{ title: string; entryCount: number }> {
        const specPath = this.getSpecFilePath();
        const content = readMarkdownFile(specPath);

        if (!content) {
            return [];
        }

        const sections = parseSections(content);

        return sections.map((section) => ({
            title: section.title,
            entryCount: (section.content.match(/^- /gm) || []).length,
        }));
    }

    /**
     * Generate the initial spec.md template
     */
    private generateSpecTemplate(): string {
        const projectName = path.basename(this.cwd);

        return `# ${projectName} - Specification

> This document is automatically maintained by VibeSync.
> It tracks features, changes, and decisions as they happen.

---

## Features

_New features will be logged here automatically._

---

## Bug Fixes

_Bug fixes will be logged here automatically._

---

## Refactoring

_Code refactoring and improvements will be logged here._

---

## Configuration

_Configuration changes will be logged here._

---

## Testing

_Test additions and changes will be logged here._

---

## Other Changes

_Miscellaneous changes will be logged here._

---

## Changelog

| Date | Category | Description |
|------|----------|-------------|

`;
    }

    /**
     * Add entry to changelog table
     */
    addToChangelog(intent: IntentResponse): SpecUpdateResult {
        const specPath = this.getSpecFilePath();
        let content = readMarkdownFile(specPath);

        if (!content) {
            return {
                success: false,
                section: 'Changelog',
                message: 'Spec file not found',
            };
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const category = intent.category.charAt(0).toUpperCase() + intent.category.slice(1);
        const entry = `| ${timestamp} | ${category} | ${intent.summary} |`;

        // Find the changelog table and append
        const changelogIndex = content.indexOf('## Changelog');
        if (changelogIndex === -1) {
            // No changelog section, append to end
            content = appendToFile(content, `## Changelog\n\n| Date | Category | Description |\n|------|----------|-------------|\n${entry}`);
        } else {
            // Find the table and append row
            const lines = content.split('\n');
            let tableEndIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('| ') && !lines[i].includes('Date') && !lines[i].includes('---')) {
                    tableEndIndex = i;
                }
            }

            if (tableEndIndex === -1) {
                // Table header exists but no entries, find separator line
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('|---')) {
                        tableEndIndex = i;
                        break;
                    }
                }
            }

            if (tableEndIndex !== -1) {
                lines.splice(tableEndIndex + 1, 0, entry);
                content = lines.join('\n');
            }
        }

        const written = writeMarkdownFile(specPath, content);

        return {
            success: written,
            section: 'Changelog',
            message: written ? 'Added to changelog' : 'Failed to update changelog',
        };
    }
}

// Singleton instance
let specUpdaterInstance: SpecUpdater | null = null;

export function getSpecUpdater(cwd?: string, config?: Partial<SpecUpdaterConfig>): SpecUpdater {
    if (!specUpdaterInstance) {
        specUpdaterInstance = new SpecUpdater(cwd, config);
    }
    return specUpdaterInstance;
}

export function resetSpecUpdater(): void {
    specUpdaterInstance = null;
}
