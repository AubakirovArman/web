import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { EnvConfig } from './types';

export function readGemmaEnv(): EnvConfig {
  const env = {
    ...parseEnvFile(path.resolve(process.cwd(), '.env')),
    ...parseEnvFile(path.resolve(process.cwd(), '..', '.env')),
    ...process.env,
  } as Record<string, string | undefined>;

  const endpoint = normalizeGemmaEndpoint(env.GEMMA_APP_BASE_URL || env.GEMMA_BASE_URL || env.VLLM_URL || 'http://89.106.235.4:8000');
  return {
    ...endpoint,
    model: env.GEMMA_MODEL || env.VLLM_MODEL || 'google/gemma-4-31B-it',
    apiKey: env.GEMMA_API_KEY || env.VLLM_API_KEY || env.GEMMA_KEY || env.GEMMA4_API_KEY || '',
  };
}

function parseEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  const text = readFileSync(envPath, 'utf-8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\s+)\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

function normalizeGemmaEndpoint(value: string) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (endpoint.endsWith('/v1/chat/completions')) return { baseUrl: endpoint.replace(/\/v1\/chat\/completions$/, ''), chatUrl: endpoint };
  if (endpoint.endsWith('/chat/completions')) return { baseUrl: endpoint.replace(/\/chat\/completions$/, ''), chatUrl: endpoint };
  if (endpoint.endsWith('/v1')) return { baseUrl: endpoint.replace(/\/v1$/, ''), chatUrl: `${endpoint}/chat/completions` };
  return { baseUrl: endpoint, chatUrl: `${endpoint}/v1/chat/completions` };
}
