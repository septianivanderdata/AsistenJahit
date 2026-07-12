import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config.js';

export const genai = new GoogleGenAI({ apiKey: config.geminiKey });

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts');

const cache = new Map<string, string>();

/** Muat template prompt dari src/prompts/<name>.md (di-cache). */
export function loadPrompt(name: string): string {
  if (!cache.has(name)) {
    cache.set(name, readFileSync(join(promptsDir, `${name}.md`), 'utf8'));
  }
  return cache.get(name)!;
}

/** Ganti placeholder {{KEY}} dengan nilai. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

/** Panggil Gemini, kembalikan teks gabungan. */
export async function complete(params: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const res = await genai.models.generateContent({
    model: config.geminiModel,
    contents: params.prompt,
    config: {
      systemInstruction: params.system,
      temperature: params.temperature ?? 0.3,
      maxOutputTokens: params.maxTokens ?? 1024,
      // Matikan "thinking" → lebih cepat & murah untuk ekstraksi/narasi (§8).
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return (res.text ?? '').trim();
}
