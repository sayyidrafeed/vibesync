// Phase 2: The Brain - Core modules
export { VibeDatabase, getDatabase, closeDatabase, type FileEvent, type EventAction } from './database.js';
export { DiffManager, getDiffManager } from './diff.js';
export { LLMClient, getLLMClient, isLLMAvailable, type IntentResponse, type LLMConfig } from './llm.js';
export { IntentEngine, getIntentEngine, shutdownIntentEngine, type IntentConfig } from './intent.js';

// Phase 3: The Record - Auto-documentation modules
export * from '../record/index.js';
