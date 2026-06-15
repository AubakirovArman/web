export interface GemmaJsonRequest {
  prompt: string;
  text: string;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
}

export interface GemmaJsonResult {
  data: Record<string, string>;
  provider: string;
  promptVersion: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  errors: string[];
  raw?: string;
}

const PROMPT_VERSION = 'gemma-extraction-v1';

function cleanJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

function normalizeJsonRecord(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, value == null ? '' : String(value)])
  );
}

export async function callGemmaJson({
  prompt,
  text,
  maxTokens = 512,
  timeoutMs = 30000,
  retries = 1,
}: GemmaJsonRequest): Promise<GemmaJsonResult> {
  const url = process.env.VLLM_URL;
  const apiKey = process.env.VLLM_API_KEY;
  const model = process.env.VLLM_MODEL;
  const provider = model ? `vllm:${model}` : 'local-parser';

  if (!url || !apiKey || !model) {
    return {
      data: { rawText: text.slice(0, 1000), extractionStatus: 'skipped', extractionError: 'VLLM environment variables are not configured' },
      provider,
      promptVersion: PROMPT_VERSION,
      status: 'skipped',
      errors: ['VLLM environment variables are not configured'],
    };
  }

  const errors: string[] = [];
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Ты помогаешь извлекать структурированные данные из фармацевтических документов. Всегда отвечай только валидным JSON.',
            },
            { role: 'user', content: `${prompt}\n\nТекст документа:\n${text.slice(0, 6000)}` },
          ],
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`VLLM request failed: ${response.status} ${body}`);
      }

      const payload = (await response.json()) as any;
      const raw = payload.choices?.[0]?.message?.content || '';
      try {
        return {
          data: normalizeJsonRecord(JSON.parse(cleanJson(raw))),
          provider,
          promptVersion: PROMPT_VERSION,
          status: 'success',
          errors,
          raw,
        };
      } catch {
        return {
          data: { rawText: text.slice(0, 1000), aiRaw: raw.slice(0, 1000) },
          provider,
          promptVersion: PROMPT_VERSION,
          status: 'partial',
          errors: [...errors, 'Model response is not valid JSON'],
          raw,
        };
      }
    } catch (error) {
      clearTimeout(timeout);
      errors.push(error instanceof Error ? error.message : 'Unknown LLM error');
    }
  }

  return {
    data: { rawText: text.slice(0, 1000), extractionStatus: 'failed', extractionError: errors.join('; ') },
    provider,
    promptVersion: PROMPT_VERSION,
    status: 'failed',
    errors,
  };
}
