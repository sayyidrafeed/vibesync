import OpenAI from 'openai';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const VIBESYNC_DIR = '.vibesync';

// Load .env from project root or .vibesync folder
loadEnv();
loadEnv({ path: path.join(process.cwd(), VIBESYNC_DIR, '.env') });

/**
 * Configuration for the LLM provider
 */
export interface LLMConfig {
    provider: 'openai';
    model: string;
    apiKey: string;
}

/**
 * Response structure from intent extraction
 */
export interface IntentResponse {
    summary: string;
    category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'config' | 'test' | 'other';
    confidence: number;
}

/**
 * LLM client for intent extraction
 */
export class LLMClient {
    private client: OpenAI | null = null;
    private model: string = 'gpt-4o-mini';

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey) {
            this.client = new OpenAI({ apiKey });
        }
    }

    /**
     * Check if the LLM client is configured
     */
    isConfigured(): boolean {
        return this.client !== null;
    }

    /**
     * Set the model to use
     */
    setModel(model: string): void {
        this.model = model;
    }

    /**
     * Extract intent from a file change
     */
    async extractIntent(
        filePath: string,
        action: string,
        diff: string | null
    ): Promise<IntentResponse | null> {
        if (!this.client) {
            return null;
        }

        const prompt = this.buildPrompt(filePath, action, diff);

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a code change analyzer. Given a file change, you extract the developer's intent.
Respond with a JSON object containing:
- "summary": A concise 1-2 sentence description of what the change accomplishes (e.g., "Added user authentication middleware")
- "category": One of: feature, bugfix, refactor, docs, config, test, other
- "confidence": A number 0-1 indicating how confident you are in the analysis

Only respond with valid JSON, no markdown or explanation.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 256,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content;

            if (!content) {
                return null;
            }

            return JSON.parse(content) as IntentResponse;
        } catch (error) {
            console.error('LLM extraction error:', error);
            return null;
        }
    }

    /**
     * Extract intent from bundled changes (multiple files)
     */
    async extractBundledIntent(
        changes: Array<{ filePath: string; action: string; diff: string | null }>
    ): Promise<IntentResponse | null> {
        if (!this.client || changes.length === 0) {
            return null;
        }

        const changesText = changes
            .map((c) => {
                const diffPreview = c.diff ? c.diff.slice(0, 500) : 'No diff available';
                return `File: ${c.filePath}\nAction: ${c.action}\nDiff:\n${diffPreview}`;
            })
            .join('\n---\n');

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a code change analyzer. Given multiple file changes from a development session, you extract the overall developer intent.
Respond with a JSON object containing:
- "summary": A concise 1-2 sentence description of the overall change (e.g., "Implemented user profile page with avatar upload")
- "category": One of: feature, bugfix, refactor, docs, config, test, other
- "confidence": A number 0-1 indicating how confident you are

Only respond with valid JSON, no markdown.`
                    },
                    {
                        role: 'user',
                        content: `Analyze these ${changes.length} file changes:\n\n${changesText}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 256,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content;

            if (!content) {
                return null;
            }

            return JSON.parse(content) as IntentResponse;
        } catch (error) {
            console.error('LLM bundled extraction error:', error);
            return null;
        }
    }

    /**
     * Build the prompt for intent extraction
     */
    private buildPrompt(filePath: string, action: string, diff: string | null): string {
        const parts = [
            `File: ${filePath}`,
            `Action: ${action}`,
        ];

        if (diff) {
            // Truncate diff if too long
            const truncatedDiff = diff.length > 2000 ? diff.slice(0, 2000) + '\n... (truncated)' : diff;
            parts.push(`Diff:\n${truncatedDiff}`);
        } else {
            parts.push('Diff: Not available (binary file or new empty file)');
        }

        return parts.join('\n\n');
    }
}

// Singleton instance
let llmInstance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
    if (!llmInstance) {
        llmInstance = new LLMClient();
    }
    return llmInstance;
}

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
    return getLLMClient().isConfigured();
}
