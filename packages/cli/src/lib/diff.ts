import * as Diff from 'diff';
import fs from 'node:fs';
import path from 'node:path';

const VIBESYNC_DIR = '.vibesync';
const SNAPSHOTS_DIR = 'snapshots';

/**
 * Manages file snapshots and diff calculation
 */
export class DiffManager {
    private snapshotsPath: string;

    constructor(cwd: string = process.cwd()) {
        this.snapshotsPath = path.join(cwd, VIBESYNC_DIR, SNAPSHOTS_DIR);
    }

    /**
     * Initialize the snapshots directory
     */
    init(): void {
        if (!fs.existsSync(this.snapshotsPath)) {
            fs.mkdirSync(this.snapshotsPath, { recursive: true });
        }
    }

    /**
     * Get the snapshot path for a given file
     */
    private getSnapshotPath(filePath: string): string {
        // Convert file path to a safe filename
        const safeName = filePath.replace(/[/\\]/g, '__').replace(/[^a-zA-Z0-9_.-]/g, '_');
        return path.join(this.snapshotsPath, `${safeName}.snapshot`);
    }

    /**
     * Get the previous content of a file from snapshot
     */
    getPreviousContent(filePath: string): string | null {
        const snapshotPath = this.getSnapshotPath(filePath);

        if (fs.existsSync(snapshotPath)) {
            try {
                return fs.readFileSync(snapshotPath, 'utf-8');
            } catch {
                return null;
            }
        }
        return null;
    }

    /**
     * Save current file content as snapshot
     */
    saveSnapshot(filePath: string, content: string): void {
        const snapshotPath = this.getSnapshotPath(filePath);

        try {
            fs.writeFileSync(snapshotPath, content, 'utf-8');
        } catch (error) {
            // Silently fail - snapshot is not critical
            console.error(`Failed to save snapshot for ${filePath}:`, error);
        }
    }

    /**
     * Delete snapshot for a file (when file is deleted)
     */
    deleteSnapshot(filePath: string): void {
        const snapshotPath = this.getSnapshotPath(filePath);

        if (fs.existsSync(snapshotPath)) {
            try {
                fs.unlinkSync(snapshotPath);
            } catch {
                // Silently fail
            }
        }
    }

    /**
     * Calculate diff between old and new content
     */
    calculateDiff(oldContent: string | null, newContent: string, filePath: string): string {
        if (oldContent === null) {
            // New file - show all content as additions
            return Diff.createPatch(filePath, '', newContent, 'none', 'new');
        }

        return Diff.createPatch(filePath, oldContent, newContent, 'old', 'new');
    }

    /**
     * Get a human-readable summary of the diff
     */
    getDiffSummary(patchString: string): { additions: number; deletions: number } {
        const lines = patchString.split('\n');
        let additions = 0;
        let deletions = 0;

        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }

        return { additions, deletions };
    }

    /**
     * Read file content safely
     */
    readFileContent(filePath: string, cwd: string = process.cwd()): string | null {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

        try {
            // Check if it's a text file (basic check)
            const stats = fs.statSync(absolutePath);

            // Skip large files (> 1MB)
            if (stats.size > 1024 * 1024) {
                return null;
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');

            // Check if content looks like binary
            if (content.includes('\0')) {
                return null;
            }

            return content;
        } catch {
            return null;
        }
    }
}

// Singleton instance
let diffInstance: DiffManager | null = null;

export function getDiffManager(cwd?: string): DiffManager {
    if (!diffInstance) {
        diffInstance = new DiffManager(cwd);
        diffInstance.init();
    }
    return diffInstance;
}
