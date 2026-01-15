import chalk from 'chalk';

/**
 * VibeSync Logger Utility
 * Color-coded console logging following the Design System color palette
 */

const prefix = chalk.hex('#00F0FF').bold('[vibesync]');

export const logger = {
    /**
     * Info message - Cyan (Vibe-Cyan: #00F0FF)
     */
    info: (message: string) => {
        console.log(`${prefix} ${chalk.hex('#00F0FF')(message)}`);
    },

    /**
     * Success message - Green (Success-Green: #00FF94)
     */
    success: (message: string) => {
        console.log(`${prefix} ${chalk.hex('#00FF94')(message)}`);
    },

    /**
     * Warning message - Amber (Alert-Amber: #FFD600)
     */
    warn: (message: string) => {
        console.log(`${prefix} ${chalk.hex('#FFD600')(message)}`);
    },

    /**
     * Error message - Red
     */
    error: (message: string) => {
        console.error(`${prefix} ${chalk.red(message)}`);
    },

    /**
     * Intent/AI message - Purple (Intent-Purple: #BD00FF)
     */
    intent: (message: string) => {
        console.log(`${prefix} ${chalk.hex('#BD00FF')(message)}`);
    },

    /**
     * File event - with specific coloring for event type
     */
    fileEvent: (type: 'created' | 'modified' | 'deleted', path: string) => {
        const colors = {
            created: '#00FF94',  // Success-Green
            modified: '#00F0FF', // Vibe-Cyan
            deleted: '#FFD600',  // Alert-Amber
        };
        const labels = {
            created: 'Created',
            modified: 'Modified',
            deleted: 'Deleted',
        };
        const color = colors[type];
        const label = labels[type];
        console.log(
            `${prefix} ${chalk.hex(color).bold(`File ${label}:`)} ${chalk.gray(path)}`
        );
    },
};
