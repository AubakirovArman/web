import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FORENSICS_URL = process.env.PDF_FORENSICS_URL || 'http://127.0.0.1:8050';

// Прокси: сравнение печати из PDF с эталонным изображением.
export async function POST(req: NextRequest) {
  try {
    const inForm = await req.formData();
    const file = inForm.get('file');
    const stamp = inForm.get('stamp');
    if (!(file instanceof File) || !(stamp instanceof File)) {
      return NextResponse.json({ error: 'Загрузите PDF и эталон печати (изображение)' }, { status: 400 });
    }
    const out = new FormData();
    out.append('file', file, file.name || 'document.pdf');
    out.append('stamp', stamp, stamp.name || 'stamp.png');
    out.append('use_gemma', String(inForm.get('use_gemma') ?? 'true'));
    const res = await fetch(`${FORENSICS_URL}/compare-stamp`, { method: 'POST', body: out });
    const data = await res.json().catch(() => ({ error: 'Сервис форензики вернул некорректный ответ' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Сервис форензики недоступен (порт 8050).' },
      { status: 502 },
    );
  }
}
