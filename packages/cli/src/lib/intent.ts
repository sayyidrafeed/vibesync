import { getDatabase, type FileEvent, type EventAction, closeDatabase } from './database.js';
import { getDiffManager } from './diff.js';
import { getLLMClient, isLLMAvailable, type IntentResponse } from './llm.js';
import { logger } from '../utils/logger.js';
import { getRecordEngine, resetRecordEngine } from '../record/index.js';

/**
 * Configuration for intent extraction
 */
export interface IntentConfig {
    debounceMs: number;      // Time to wait before processing changes
    batchSize: number;       // Max changes to bundle together
    enableLLM: boolean;      // Whether to use LLM for extraction
}

const DEFAULT_CONFIG: IntentConfig = {
    debounceMs: 3000,        // Wait 3 seconds after last change
    batchSize: 10,           // Bundle up to 10 changes
    enableLLM: true,
};

/**
 * Pending change for batching
 */
interface PendingChange {
    filePath: string;
    action: EventAction;
    timestamp: string;
    diff: string | null;
}

/**
 * Intent extraction engine
 * Batches file changes, extracts diffs, sends to LLM, stores in database
 */
export class IntentEngine {
    private config: IntentConfig;
    private pendingChanges: PendingChange[] = [];
    private debounceTimer: NodeJS.Timeout | null = null;
    private cwd: string;

    constructor(cwd: string = process.cwd(), config: Partial<IntentConfig> = {}) {
        this.cwd = cwd;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the engine (database, diff manager)
     */
    init(): void {
        getDatabase(this.cwd);
        getDiffManager(this.cwd);

        if (this.config.enableLLM && !isLLMAvailable()) {
            logger.warn('OPENAI_API_KEY not set. LLM intent extraction disabled.');
            logger.info('Set OPENAI_API_KEY environment variable to enable AI analysis.');
            this.config.enableLLM = false;
        } else if (this.config.enableLLM) {
            logger.success('LLM intent extraction enabled (OpenAI).');
        }
    }

    /**
     * Record a file change event
     */
    recordChange(filePath: string, action: EventAction): void {
        const diffManager = getDiffManager(this.cwd);
        const timestamp = new Date().toISOString();
        let diff: string | null = null;

        if (action === 'change' || action === 'add') {
            const currentContent = diffManager.readFileContent(filePath, this.cwd);

            if (currentContent !== null) {
                if (action === 'add') {
                    // New file - diff against empty
                    diff = diffManager.calculateDiff(null, currentContent, filePath);
                } else {
                    // Changed file - diff against snapshot
                    const previousContent = diffManager.getPreviousContent(filePath);
                    diff = diffManager.calculateDiff(previousContent, currentContent, filePath);
                }

                // Update snapshot
                diffManager.saveSnapshot(filePath, currentContent);
            }
        } else if (action === 'unlink') {
            // File deleted - remove snapshot
            diffManager.deleteSnapshot(filePath);
        }

        // Add to pending changes
        this.pendingChanges.push({
            filePath,
            action,
            timestamp,
            diff,
        });

        // Reset debounce timer
        this.scheduleProcessing();
    }

    /**
     * Schedule processing of pending changes
     */
    private scheduleProcessing(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processChanges();
        }, this.config.debounceMs);
    }

    /**
     * Process all pending changes
     */
    private async processChanges(): Promise<void> {
        if (this.pendingChanges.length === 0) {
            return;
        }

        const changes = [...this.pendingChanges];
        this.pendingChanges = [];

        logger.info(`Processing ${changes.length} file change(s)...`);

        const db = getDatabase(this.cwd);
        const llm = getLLMClient();

        // Store each event in the database
        const eventIds: number[] = [];
        for (const change of changes) {
            const id = db.insertEvent({
                timestamp: change.timestamp,
                filePath: change.filePath,
                action: change.action,
                diff: change.diff,
                intent: null, // Will be updated after LLM processing
            });
            eventIds.push(id);
        }

        // Skip LLM processing if disabled
        if (!this.config.enableLLM) {
            logger.info('Events stored (LLM disabled).');
            return;
        }

        // Extract intent using LLM
        try {
            let intentResult;

            if (changes.length === 1) {
                // Single file change
                const change = changes[0];
                intentResult = await llm.extractIntent(
                    change.filePath,
                    change.action,
                    change.diff
                );
            } else {
                // Multiple changes - bundle them
                intentResult = await llm.extractBundledIntent(
                    changes.map((c) => ({
                        filePath: c.filePath,
                        action: c.action,
                        diff: c.diff,
                    }))
                );
            }

            if (intentResult) {
                const summary = `[${intentResult.category.toUpperCase()}] ${intentResult.summary}`;

                // Update all events with the extracted intent
                for (const id of eventIds) {
                    db.updateIntent(id, summary);
                }

                logger.success(`Intent: ${summary}`);

                // Phase 3: Update documentation based on intent
                try {
                    const recordEngine = getRecordEngine(this.cwd);
                    const recordResult = recordEngine.processIntent(intentResult);

                    if (recordResult.taskResult?.updatedTasks.length) {
                        logger.info(`📋 task.md updated (${recordResult.taskResult.updatedTasks.length} task(s))`);
                    }
                    if (recordResult.specResult?.success && recordResult.specResult.section) {
                        logger.info(`📝 spec.md updated (${recordResult.specResult.section})`);
                    }
                } catch (recordError) {
                    logger.warn(`Record update skipped: ${(recordError as Error).message}`);
                }
            } else {
                logger.warn('Could not extract intent from changes.');
            }
        } catch (error) {
            logger.error(`Intent extraction failed: ${(error as Error).message}`);
        }
    }

    /**
     * Force process any remaining changes (useful on shutdown)
     */
    async flush(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        await this.processChanges();
    }

    /**
     * Shutdown the engine
     */
    async shutdown(): Promise<void> {
        await this.flush();
        resetRecordEngine();
        closeDatabase();
    }
}

// Singleton instance
let engineInstance: IntentEngine | null = null;

export function getIntentEngine(cwd?: string, config?: Partial<IntentConfig>): IntentEngine {
    if (!engineInstance) {
        engineInstance = new IntentEngine(cwd, config);
        engineInstance.init();
    }
    return engineInstance;
}

export function shutdownIntentEngine(): Promise<void> {
    if (engineInstance) {
        return engineInstance.shutdown();
    }
    return Promise.resolve();
}
