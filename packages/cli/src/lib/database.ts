import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const VIBESYNC_DIR = '.vibesync';
const DB_NAME = 'db.sqlite';

/**
 * Event types for file system changes
 */
export type EventAction = 'add' | 'change' | 'unlink';

/**
 * Structure for a single file event
 */
export interface FileEvent {
    id?: number;
    timestamp: string;
    filePath: string;
    action: EventAction;
    diff: string | null;
    intent: string | null;
    createdAt?: string;
}

/**
 * Database manager for VibeSync events
 */
export class VibeDatabase {
    private db: DatabaseType | null = null;
    private dbPath: string;

    constructor(cwd: string = process.cwd()) {
        this.dbPath = path.join(cwd, VIBESYNC_DIR, DB_NAME);
    }

    /**
     * Initialize the database and create tables if they don't exist
     */
    init(): void {
        // Ensure .vibesync directory exists
        const vibesyncDir = path.dirname(this.dbPath);
        if (!fs.existsSync(vibesyncDir)) {
            fs.mkdirSync(vibesyncDir, { recursive: true });
        }

        this.db = new Database(this.dbPath);

        // Enable WAL mode for better concurrent performance
        this.db.pragma('journal_mode = WAL');

        // Create events table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                file_path TEXT NOT NULL,
                action TEXT NOT NULL,
                diff TEXT,
                intent TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_file ON events(file_path);
        `);
    }

    /**
     * Insert a new file event into the database
     */
    insertEvent(event: Omit<FileEvent, 'id' | 'createdAt'>): number {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        const stmt = this.db.prepare(`
            INSERT INTO events (timestamp, file_path, action, diff, intent)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            event.timestamp,
            event.filePath,
            event.action,
            event.diff,
            event.intent
        );

        return result.lastInsertRowid as number;
    }

    /**
     * Update the intent for an existing event
     */
    updateIntent(id: number, intent: string): void {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        const stmt = this.db.prepare(`
            UPDATE events SET intent = ? WHERE id = ?
        `);

        stmt.run(intent, id);
    }

    /**
     * Get all events, optionally limited
     */
    getEvents(limit: number = 100): FileEvent[] {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        const stmt = this.db.prepare(`
            SELECT id, timestamp, file_path as filePath, action, diff, intent, created_at as createdAt
            FROM events
            ORDER BY id DESC
            LIMIT ?
        `);

        return stmt.all(limit) as FileEvent[];
    }

    /**
     * Get events pending intent extraction (where intent is NULL)
     */
    getPendingEvents(limit: number = 10): FileEvent[] {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        const stmt = this.db.prepare(`
            SELECT id, timestamp, file_path as filePath, action, diff, intent, created_at as createdAt
            FROM events
            WHERE intent IS NULL
            ORDER BY id ASC
            LIMIT ?
        `);

        return stmt.all(limit) as FileEvent[];
    }

    /**
     * Get recent events within a time window (for bundling)
     */
    getRecentEvents(sinceMs: number = 5000): FileEvent[] {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        const sinceTimestamp = new Date(Date.now() - sinceMs).toISOString();

        const stmt = this.db.prepare(`
            SELECT id, timestamp, file_path as filePath, action, diff, intent, created_at as createdAt
            FROM events
            WHERE timestamp >= ?
            ORDER BY id ASC
        `);

        return stmt.all(sinceTimestamp) as FileEvent[];
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Check if database is initialized
     */
    isInitialized(): boolean {
        return this.db !== null;
    }
}

// Singleton instance for the CLI
let dbInstance: VibeDatabase | null = null;

export function getDatabase(cwd?: string): VibeDatabase {
    if (!dbInstance) {
        dbInstance = new VibeDatabase(cwd);
        dbInstance.init();
    }
    return dbInstance;
}

export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
