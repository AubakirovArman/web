import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RAG_URL = process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8053';

/**
 * Проксирует чат-запрос к rag-сервису и стримит SSE обратно клиенту.
 * Тело: { question: string, history?: {role,content}[] }
 */
export async function POST(req: NextRequest) {
  let body: { question?: string; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Некорректный JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = String(body?.question || '').trim();
  if (!question) {
    return new Response(JSON.stringify({ error: 'Пустой вопрос' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${RAG_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: Array.isArray(body.history) ? body.history : null }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'RAG-сервис недоступен. Запустите rag-chat/service на :8053.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(JSON.stringify({ error: `Ошибка RAG-сервиса: ${upstream.status} ${text}`.trim() }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Пробрасываем SSE-поток как есть.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
