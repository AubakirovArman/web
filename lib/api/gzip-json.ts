import { NextRequest, NextResponse } from 'next/server';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

/**
 * JSON-ответ со сжатием (gzip), если клиент его поддерживает и тело большое.
 * Next по умолчанию НЕ сжимает ответы app-router route handlers, поэтому
 * для тяжёлых JSON (конфиг, заявки) сжимаем явно — это режет трафик ~10×.
 */
export async function gzipJson(
  req: NextRequest,
  data: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Promise<NextResponse> {
  const body = JSON.stringify(data);
  const accept = req.headers.get('accept-encoding') || '';
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    vary: 'Accept-Encoding',
    ...(init?.headers || {}),
  };
  if (body.length > 1024 && /\bgzip\b/.test(accept)) {
    const compressed = await gzipAsync(body);
    headers['content-encoding'] = 'gzip';
    return new NextResponse(compressed, { status: init?.status ?? 200, headers });
  }
  return new NextResponse(body, { status: init?.status ?? 200, headers });
}
