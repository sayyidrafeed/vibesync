/**
 * Phase 3: The Record - Auto-Documentation Module
 * 
 * Main orchestrator that connects intent extraction to documentation updates.
 * Manages both spec.md and task.md updates based on detected developer intents.
 */

import { logger } from '../utils/logger.js';
import type { IntentResponse } from '../lib/llm.js';
import {
    TaskUpdater,
    getTaskUpdater,
    resetTaskUpdater,
    type TaskUpdaterConfig,
    type TaskUpdateResult,
} from './task-updater.js';
import {
    SpecUpdater,
    getSpecUpdater,
    resetSpecUpdater,
    type SpecUpdaterConfig,
    type SpecUpdateResult,
} from './spec-updater.js';

// Re-export types and utilities
export * from './markdown-parser.js';
export * from './task-updater.js';
export * from './spec-updater.js';

/**
 * Configuration for the Record module
 */
export interface RecordConfig {
    enableTaskUpdates: boolean;
    enableSpecUpdates: boolean;
    taskConfig?: Partial<TaskUpdaterConfig>;
    specConfig?: Partial<SpecUpdaterConfig>;
}

const DEFAULT_CONFIG: RecordConfig = {
    enableTaskUpdates: true,
    enableSpecUpdates: true,
};

/**
 * Result from processing an intent
 */
export interface RecordResult {
    taskResult: TaskUpdateResult | null;
    specResult: SpecUpdateResult | null;
}

/**
 * The Record Engine
 * Main coordinator for Phase 3 auto-documentation
 */
export class RecordEngine {
    private config: RecordConfig;
    private cwd: string;
    private taskUpdater: TaskUpdater;
    private specUpdater: SpecUpdater;

    constructor(cwd: string = process.cwd(), config: Partial<RecordConfig> = {}) {
        this.cwd = cwd;
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.taskUpdater = getTaskUpdater(cwd, config.taskConfig);
        this.specUpdater = getSpecUpdater(cwd, config.specConfig);
    }

    /**
     * Initialize the Record module
     * Creates necessary files if they don't exist
     */
    init(): void {
        logger.info('Initializing Record module (Phase 3)...');

        // Initialize spec.md if enabled
        if (this.config.enableSpecUpdates) {
            this.specUpdater.initializeSpec();
        }

        logger.success('Record module initialized.');
    }

    /**
     * Process an intent and update documentation
     * This is the main entry point called after LLM intent extraction
     */
    processIntent(intent: IntentResponse): RecordResult {
        const result: RecordResult = {
            taskResult: null,
            specResult: null,
        };

        logger.info(`Processing intent: [${intent.category.toUpperCase()}] ${intent.summary}`);

        // Update task.md
        if (this.config.enableTaskUpdates) {
            try {
                result.taskResult = this.taskUpdater.processIntent(intent);

                if (result.taskResult.updatedTasks.length > 0) {
                    logger.success(`Updated ${result.taskResult.updatedTasks.length} task(s) in task.md`);
                }
            } catch (error) {
                logger.error(`Task update failed: ${(error as Error).message}`);
            }
        }

        // Update spec.md
        if (this.config.enableSpecUpdates) {
            try {
                result.specResult = this.specUpdater.processIntent(intent);

                if (result.specResult.success && result.specResult.section) {
                    // Also add to changelog for significant changes
                    if (intent.category === 'feature' || intent.category === 'bugfix') {
                        this.specUpdater.addToChangelog(intent);
                    }
                }
            } catch (error) {
                logger.error(`Spec update failed: ${(error as Error).message}`);
            }
        }

        return result;
    }

    /**
     * Get access to the task updater for direct operations
     */
    getTaskUpdater(): TaskUpdater {
        return this.taskUpdater;
    }

    /**
     * Get access to the spec updater for direct operations
     */
    getSpecUpdater(): SpecUpdater {
        return this.specUpdater;
    }

    /**
     * Get current documentation status
     */
    getStatus(): {
        taskProgress: { total: number; completed: number; remaining: number };
        specSections: Array<{ title: string; entryCount: number }>;
    } {
        return {
            taskProgress: this.taskUpdater.getProgress(),
            specSections: this.specUpdater.getSections(),
        };
    }

    /**
     * Manually mark a task as complete
     */
    completeTask(taskDescription: string): TaskUpdateResult {
        return this.taskUpdater.markTaskComplete(taskDescription);
    }

    /**
     * Manually add an entry to spec
     */
    addSpecEntry(category: IntentResponse['category'], description: string): SpecUpdateResult {
        return this.specUpdater.addEntry(category, description);
    }
}

// Singleton instance
let recordEngineInstance: RecordEngine | null = null;

export function getRecordEngine(cwd?: string, config?: Partial<RecordConfig>): RecordEngine {
    if (!recordEngineInstance) {
        recordEngineInstance = new RecordEngine(cwd, config);
    }
    return recordEngineInstance;
}

export function initRecordEngine(cwd?: string, config?: Partial<RecordConfig>): RecordEngine {
    const engine = getRecordEngine(cwd, config);
    engine.init();
    return engine;
}

export function resetRecordEngine(): void {
    resetTaskUpdater();
    resetSpecUpdater();
    recordEngineInstance = null;
}
