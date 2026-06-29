import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FORENSICS_URL = process.env.PDF_FORENSICS_URL || 'http://127.0.0.1:8050';

// Прокси к сервису PDF-форензики: анализ подлинности загруженного PDF.
export async function POST(req: NextRequest) {
  try {
    const inForm = await req.formData();
    const file = inForm.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Загрузите PDF-файл' }, { status: 400 });
    }
    const out = new FormData();
    out.append('file', file, file.name || 'document.pdf');
    out.append('use_gemma', String(inForm.get('use_gemma') ?? 'true'));
    const res = await fetch(`${FORENSICS_URL}/analyze`, { method: 'POST', body: out });
    const data = await res.json().catch(() => ({ error: 'Сервис форензики вернул некорректный ответ' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Сервис форензики недоступен. Проверьте, что pdf-forensics запущен (порт 8050).' },
      { status: 502 },
    );
  }
}
