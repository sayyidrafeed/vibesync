import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { getDatabase, closeDatabase, initRecordEngine, resetRecordEngine } from '../lib/index.js';

const VIBESYNC_DIR = '.vibesync';

/**
 * Default configuration for VibeSync
 */
const defaultConfig = {
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    watchPatterns: ['**/*'],
    ignorePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.vibesync/**',
        '**/dist/**',
        '**/.turbo/**',
    ],
    llm: {
        provider: 'openai',
        model: 'gpt-4o-mini',
    },
    // Phase 3: Auto-documentation config
    record: {
        taskFile: 'task.md',
        specFile: 'docs/spec.md',
        autoUpdateTasks: true,
        autoUpdateSpec: true,
    },
};

/**
 * Initialize VibeSync in the current directory
 * Creates the .vibesync folder with config.json and database
 */
export function initCommand(): void {
    const cwd = process.cwd();
    const vibesyncPath = path.join(cwd, VIBESYNC_DIR);

    // Check if already initialized
    if (fs.existsSync(vibesyncPath)) {
        logger.warn(`VibeSync already initialized in ${cwd}`);
        logger.info(`Config folder: ${vibesyncPath}`);
        return;
    }

    try {
        // Create .vibesync directory
        fs.mkdirSync(vibesyncPath, { recursive: true });

        // Create config.json
        const configPath = path.join(vibesyncPath, 'config.json');
        fs.writeFileSync(
            configPath,
            JSON.stringify(defaultConfig, null, 2),
            'utf-8'
        );

        // Create snapshots directory for diff tracking
        fs.mkdirSync(path.join(vibesyncPath, 'snapshots'), { recursive: true });

        // Initialize SQLite database
        const db = getDatabase(cwd);
        closeDatabase();

        // Phase 3: Create docs directory and initialize spec.md
        const docsPath = path.join(cwd, 'docs');
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath, { recursive: true });
        }

        // Initialize Record module (creates spec.md template)
        const recordEngine = initRecordEngine(cwd);
        resetRecordEngine();

        logger.success('VibeSync initialized successfully!');
        logger.info(`Config folder: ${vibesyncPath}`);
        logger.info(`Database: ${path.join(vibesyncPath, 'db.sqlite')}`);
        logger.info(`Spec file: ${path.join(cwd, 'docs/spec.md')}`);
        console.log('');
        logger.info('To enable AI intent extraction, set your OpenAI API key:');
        logger.info('  export OPENAI_API_KEY="sk-..."');
        console.log('');
        logger.info('Phase 3 Auto-Documentation enabled:');
        logger.info('  📋 task.md - Tasks auto-completed when work detected');
        logger.info('  📝 docs/spec.md - Features auto-logged');
        console.log('');
        logger.info('Run `vibe watch` to start monitoring your project.');
    } catch (error) {
        logger.error(`Failed to initialize VibeSync: ${(error as Error).message}`);
        process.exit(1);
    }
}
