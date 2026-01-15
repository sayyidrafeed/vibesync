/**
 * Task Updater Module
 * 
 * Automatically updates task.md based on extracted intents.
 * Marks tasks as complete when matching work is detected.
 */

import path from 'node:path';
import { logger } from '../utils/logger.js';
import {
    parseTaskItems,
    findMatchingTasks,
    updateTaskStatus,
    readMarkdownFile,
    writeMarkdownFile,
    type TaskItem,
} from './markdown-parser.js';
import type { IntentResponse } from '../lib/llm.js';

const DEFAULT_TASK_FILE = 'task.md';

/**
 * Configuration for task updater
 */
export interface TaskUpdaterConfig {
    taskFilePath: string;       // Path to task.md
    matchThreshold: number;     // Similarity threshold (0-1)
    autoMarkComplete: boolean;  // Auto mark tasks as complete
}

const DEFAULT_CONFIG: TaskUpdaterConfig = {
    taskFilePath: DEFAULT_TASK_FILE,
    matchThreshold: 0.35,
    autoMarkComplete: true,
};

/**
 * Result of a task update operation
 */
export interface TaskUpdateResult {
    success: boolean;
    updatedTasks: TaskItem[];
    message: string;
}

/**
 * Task Updater class
 * Watches for intents and updates task.md accordingly
 */
export class TaskUpdater {
    private config: TaskUpdaterConfig;
    private cwd: string;

    constructor(cwd: string = process.cwd(), config: Partial<TaskUpdaterConfig> = {}) {
        this.cwd = cwd;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get the full path to the task file
     */
    getTaskFilePath(): string {
        return path.join(this.cwd, this.config.taskFilePath);
    }

    /**
     * Process an intent and update task.md if applicable
     */
    processIntent(intent: IntentResponse): TaskUpdateResult {
        const taskFilePath = this.getTaskFilePath();
        const content = readMarkdownFile(taskFilePath);

        if (!content) {
            return {
                success: false,
                updatedTasks: [],
                message: `Task file not found: ${taskFilePath}`,
            };
        }

        // Parse existing tasks
        const tasks = parseTaskItems(content);

        if (tasks.length === 0) {
            return {
                success: false,
                updatedTasks: [],
                message: 'No tasks found in task.md',
            };
        }

        // Find matching tasks based on intent summary
        const matchingTasks = findMatchingTasks(
            tasks,
            intent.summary,
            this.config.matchThreshold
        );

        if (matchingTasks.length === 0) {
            return {
                success: true,
                updatedTasks: [],
                message: 'No matching tasks found for this intent',
            };
        }

        // Auto-mark matching tasks as complete
        if (!this.config.autoMarkComplete) {
            return {
                success: true,
                updatedTasks: matchingTasks,
                message: `Found ${matchingTasks.length} matching task(s) but auto-complete is disabled`,
            };
        }

        // Update the task file
        let updatedContent = content;
        const updatedTasks: TaskItem[] = [];

        for (const task of matchingTasks) {
            // Only mark the first/best match as complete to avoid false positives
            if (updatedTasks.length === 0 && intent.confidence > 0.5) {
                updatedContent = updateTaskStatus(updatedContent, task.line, 'checked');
                updatedTasks.push(task);
                logger.success(`Task completed: "${task.text}"`);
            }
        }

        // Check if parent tasks should be marked complete
        updatedContent = this.updateParentTasks(updatedContent);

        // Write the updated content
        if (updatedTasks.length > 0) {
            const written = writeMarkdownFile(taskFilePath, updatedContent);
            if (!written) {
                return {
                    success: false,
                    updatedTasks: [],
                    message: 'Failed to write updated task.md',
                };
            }
        }

        return {
            success: true,
            updatedTasks,
            message: updatedTasks.length > 0
                ? `Marked ${updatedTasks.length} task(s) as complete`
                : 'No tasks updated',
        };
    }

    /**
     * Mark a specific task as complete by text match
     */
    markTaskComplete(taskText: string): TaskUpdateResult {
        const taskFilePath = this.getTaskFilePath();
        const content = readMarkdownFile(taskFilePath);

        if (!content) {
            return {
                success: false,
                updatedTasks: [],
                message: `Task file not found: ${taskFilePath}`,
            };
        }

        const tasks = parseTaskItems(content);
        const matchingTasks = findMatchingTasks(tasks, taskText, 0.5);

        if (matchingTasks.length === 0) {
            return {
                success: false,
                updatedTasks: [],
                message: `No matching task found for: "${taskText}"`,
            };
        }

        const task = matchingTasks[0];
        let updatedContent = updateTaskStatus(content, task.line, 'checked');
        updatedContent = this.updateParentTasks(updatedContent);

        const written = writeMarkdownFile(taskFilePath, updatedContent);

        return {
            success: written,
            updatedTasks: [task],
            message: written ? `Marked complete: "${task.text}"` : 'Failed to write task.md',
        };
    }

    /**
     * Mark a task as in-progress
     */
    markTaskInProgress(taskText: string): TaskUpdateResult {
        const taskFilePath = this.getTaskFilePath();
        const content = readMarkdownFile(taskFilePath);

        if (!content) {
            return {
                success: false,
                updatedTasks: [],
                message: `Task file not found: ${taskFilePath}`,
            };
        }

        const tasks = parseTaskItems(content);
        const matchingTasks = findMatchingTasks(tasks, taskText, 0.5);

        if (matchingTasks.length === 0) {
            return {
                success: false,
                updatedTasks: [],
                message: `No matching task found for: "${taskText}"`,
            };
        }

        const task = matchingTasks[0];
        const updatedContent = updateTaskStatus(content, task.line, 'in-progress');
        const written = writeMarkdownFile(taskFilePath, updatedContent);

        return {
            success: written,
            updatedTasks: [task],
            message: written ? `Marked in-progress: "${task.text}"` : 'Failed to write task.md',
        };
    }

    /**
     * Update parent tasks when all subtasks are complete
     */
    private updateParentTasks(content: string): string {
        const tasks = parseTaskItems(content);
        let updatedContent = content;

        // Group tasks by parent (using indentation)
        const tasksByIndent = new Map<number, TaskItem[]>();

        for (const task of tasks) {
            if (!tasksByIndent.has(task.indent)) {
                tasksByIndent.set(task.indent, []);
            }
            tasksByIndent.get(task.indent)!.push(task);
        }

        // Find parent tasks (those with higher indent children)
        const maxIndent = Math.max(...tasksByIndent.keys());

        for (let indent = maxIndent; indent > 0; indent--) {
            const childTasks = tasksByIndent.get(indent) || [];

            for (const task of tasks.filter(t => t.indent === indent - 1)) {
                // Find children of this task (tasks with higher indent after this task)
                const children = childTasks.filter(
                    child => child.line > task.line &&
                        !tasks.some(t => t.line > task.line && t.line < child.line && t.indent <= task.indent)
                );

                // If all children are checked, mark parent as checked
                if (children.length > 0 && children.every(c => c.status === 'checked')) {
                    const currentTasks = parseTaskItems(updatedContent);
                    const currentTask = currentTasks.find(t => t.line === task.line);

                    if (currentTask && currentTask.status !== 'checked') {
                        updatedContent = updateTaskStatus(updatedContent, task.line, 'checked');
                        logger.info(`Parent task auto-completed: "${task.text}"`);
                    }
                }
            }
        }

        return updatedContent;
    }

    /**
     * Get all tasks with their current status
     */
    getAllTasks(): TaskItem[] {
        const taskFilePath = this.getTaskFilePath();
        const content = readMarkdownFile(taskFilePath);

        if (!content) {
            return [];
        }

        return parseTaskItems(content);
    }

    /**
     * Get progress summary
     */
    getProgress(): { total: number; completed: number; inProgress: number; remaining: number } {
        const tasks = this.getAllTasks();

        return {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'checked').length,
            inProgress: tasks.filter(t => t.status === 'in-progress').length,
            remaining: tasks.filter(t => t.status === 'unchecked').length,
        };
    }
}

// Singleton instance
let taskUpdaterInstance: TaskUpdater | null = null;

export function getTaskUpdater(cwd?: string, config?: Partial<TaskUpdaterConfig>): TaskUpdater {
    if (!taskUpdaterInstance) {
        taskUpdaterInstance = new TaskUpdater(cwd, config);
    }
    return taskUpdaterInstance;
}

export function resetTaskUpdater(): void {
    taskUpdaterInstance = null;
}
