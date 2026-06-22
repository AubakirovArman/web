'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, UploadCloud } from 'lucide-react';
import type { NpaGemmaPreview } from '@/lib/admin/admin-page-types';

export function NpaAddDialog({
  open,
  onClose,
  onPreview,
}: {
  open: boolean;
  onClose: () => void;
  onPreview: (preview: NpaGemmaPreview) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [actType, setActType] = useState('');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setName('');
    setActType('');
    setNumber('');
    setDate('');
    setError(null);
    setLoading(false);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const analyze = async () => {
    if (!file) {
      setError('Выберите файл .docx, .doc или .pdf');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (name) form.append('name', name);
      if (actType) form.append('actType', actType);
      if (number) form.append('number', number);
      if (date) form.append('date', date);
      const response = await fetch('/api/admin/npa-gemma-preview', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || 'Не удалось проанализировать документ');
        return;
      }
      onPreview(data as NpaGemmaPreview);
      reset();
    } catch {
      setError('Сеть недоступна или анализ занял слишком долго. Повторите.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Добавить НПА — анализ Gemma</DialogTitle>
          <DialogDescription>
            Загрузите акт (.docx, .doc или .pdf). Документ будет распарсен и отправлен в Gemma для извлечения требований,
            типов документов и параметров. Результат покажется на экране проверки.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm transition-colors hover:bg-muted/40">
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <span className="font-medium">{file ? file.name : 'Выбрать файл .docx / .doc / .pdf'}</span>
            <input
              type="file"
              accept=".doc,.docx,.pdf"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Название (необязательно)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Решение № 78" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Тип акта</label>
              <Input value={actType} onChange={(e) => setActType(e.target.value)} placeholder="Решение / Приказ" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Номер</label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="78" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Дата</label>
              <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="2016-11-03" />
            </div>
          </div>

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={loading}>Отмена</Button>
            <Button onClick={analyze} disabled={loading || !file}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? 'Анализ Gemma…' : 'Анализировать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
