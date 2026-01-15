#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { watchCommand } from './commands/watch.js';

const program = new Command();

program
    .name('vibe')
    .description('VibeSync - Bridge Vibe Coding with Engineering Standards')
    .version('0.1.0');

program
    .command('init')
    .description('Initialize VibeSync in the current directory')
    .action(initCommand);

program
    .command('watch')
    .description('Start watching for file changes')
    .action(watchCommand);

program.parse();
