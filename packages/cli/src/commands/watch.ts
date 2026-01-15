import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { logger } from '../utils/logger.js';
import { getIntentEngine, shutdownIntentEngine, type EventAction } from '../lib/index.js';

const VIBESYNC_DIR = '.vibesync';

/**
 * Directories and patterns to ignore when watching (chokidar v4 compatible)
 */
const DEFAULT_IGNORE_DIRS = ['node_modules', '.git', '.vibesync', 'dist', '.turbo'];
const DEFAULT_IGNORE_EXTENSIONS = ['.log'];

/**
 * Create chokidar v4 compatible ignored function
 */
function createIgnoreFunction(ignoreDirs: string[], ignoreExtensions: string[]) {
    return (filePath: string, stats?: fs.Stats): boolean => {
        // Always ignore hidden directories patterns
        for (const dir of ignoreDirs) {
            if (filePath.includes(`/${dir}/`) || filePath.includes(`/${dir}`) || filePath.startsWith(`${dir}/`) || filePath === dir) {
                return true;
            }
        }
        // Ignore files with specific extensions
        if (stats?.isFile()) {
            for (const ext of ignoreExtensions) {
                if (filePath.endsWith(ext)) {
                    return true;
                }
            }
        }
        return false;
    };
}

/**
 * Config type for chokidar v4 compatible ignore settings
 */
interface VibesyncConfig {
    ignoreDirs?: string[];
    ignoreExtensions?: string[];
}

/**
 * Load config from .vibesync/config.json if exists
 */
function loadConfig(): VibesyncConfig | null {
    const cwd = process.cwd();
    const configPath = path.join(cwd, VIBESYNC_DIR, 'config.json');

    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return config;
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Start watching the current directory for file changes
 */
export function watchCommand(): void {
    const cwd = process.cwd();
    const vibesyncPath = path.join(cwd, VIBESYNC_DIR);

    // Check if initialized
    if (!fs.existsSync(vibesyncPath)) {
        logger.warn('VibeSync not initialized in this directory.');
        logger.info('Run `vibe init` first to initialize VibeSync.');
        process.exit(1);
    }

    // Load config for ignore patterns (chokidar v4 compatible)
    const config = loadConfig();
    const ignoreDirs = config?.ignoreDirs || DEFAULT_IGNORE_DIRS;
    const ignoreExtensions = config?.ignoreExtensions || DEFAULT_IGNORE_EXTENSIONS;
    const ignoredFn = createIgnoreFunction(ignoreDirs, ignoreExtensions);

    logger.info('Starting VibeSync watcher...');
    logger.info(`Watching: ${cwd}`);
    logger.info(`Ignoring: ${ignoreDirs.length} directories, ${ignoreExtensions.length} extensions`);
    console.log('');

    // Initialize the Intent Engine (Phase 2)
    const intentEngine = getIntentEngine(cwd);

    // Initialize chokidar watcher (v4 function-based ignored)
    const watcher = chokidar.watch('.', {
        cwd,
        ignored: ignoredFn,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50,
        },
    });

    // File created
    watcher.on('add', (filePath: string) => {
        logger.fileEvent('created', filePath);
        intentEngine.recordChange(filePath, 'add' as EventAction);
    });

    // File modified
    watcher.on('change', (filePath: string) => {
        logger.fileEvent('modified', filePath);
        intentEngine.recordChange(filePath, 'change' as EventAction);
    });

    // File deleted
    watcher.on('unlink', (filePath: string) => {
        logger.fileEvent('deleted', filePath);
        intentEngine.recordChange(filePath, 'unlink' as EventAction);
    });

    // Directory created
    watcher.on('addDir', (dirPath: string) => {
        if (dirPath !== '.') {
            logger.info(`Directory Created: ${dirPath}`);
        }
    });

    // Directory deleted
    watcher.on('unlinkDir', (dirPath: string) => {
        logger.warn(`Directory Deleted: ${dirPath}`);
    });

    // Watcher ready
    watcher.on('ready', () => {
        logger.success('Watcher ready! Listening for changes...');
        logger.info('Press Ctrl+C to stop.');
        console.log('');
    });

    // Error handling
    watcher.on('error', (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Watcher error: ${message}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('');
        logger.info('Stopping watcher...');

        // Flush any pending intent extractions
        await shutdownIntentEngine();

        await watcher.close();
        logger.success('VibeSync stopped. Goodbye!');
        process.exit(0);
    });
}

