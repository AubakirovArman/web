import { NextResponse } from 'next/server';

const MAX_MB = Number(process.env.NDDA_MAX_UPLOAD_MB || 60);
const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'txt']);
const ALLOWED_MIME = ['pdf', 'word', 'msword', 'officedocument', 'excel', 'spreadsheet', 'jpeg', 'png', 'text', 'octet-stream'];

/**
 * Проверяет загружаемый файл по размеру и типу ДО чтения буфера в память
 * (file.size доступен без arrayBuffer). Возвращает NextResponse при ошибке,
 * либо null если файл допустим.
 */
export function checkUploadFile(file: File): NextResponse | null {
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Пустой или отсутствующий файл' }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Файл превышает лимит ${MAX_MB} МБ` },
      { status: 413 },
    );
  }
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = String(file.type || '').toLowerCase();
  const extOk = ALLOWED_EXT.has(ext);
  const mimeOk = !mime || ALLOWED_MIME.some((m) => mime.includes(m));
  if (!extOk && !mimeOk) {
    return NextResponse.json(
      { error: `Недопустимый тип файла${ext ? ` (.${ext})` : ''}. Разрешены: ${Array.from(ALLOWED_EXT).join(', ')}` },
      { status: 415 },
    );
  }
  return null;
}
