'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, BookOpen, Loader2, Send, User, Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/shared/site-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface Source {
  n: number;
  doc: string;
  heading?: string;
  document_id?: string;
  domain?: string;
  snippet?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  domain?: string | null;
  intent?: string;
  streaming?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  'Какой срок действия регистрационного удостоверения лекарственного средства?',
  'Какие документы нужны для регистрации медицинского изделия класса риска 2а?',
  'Что такое оригинальный лекарственный препарат?',
  'Чем подтверждают безопасность медизделия?',
];

// Лёгкий рендер: **жирный**, переносы строк, подсветка ссылок [n].
function renderAnswer(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+(?:,\s*\d+)*\])/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\[\d+(?:,\s*\d+)*\]$/.test(p))
      return (
        <span key={i} className="mx-0.5 rounded bg-primary/10 px-1 text-xs font-medium text-primary">
          {p}
        </span>
      );
    return <span key={i}>{p}</span>;
  });
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(
    async (questionRaw: string) => {
      const question = questionRaw.trim();
      if (!question || busy) return;
      setBusy(true);
      setInput('');

      const history = messages
        .filter((m) => !m.error)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: '', streaming: true },
      ]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Ошибка ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const update = (patch: Partial<Message>) =>
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, ...patch };
            return next;
          });

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith('data:')) continue;
            let obj: Record<string, unknown>;
            try {
              obj = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (obj.type === 'meta') {
              const u = (obj.understanding as { intent?: string; domain?: string }) || {};
              update({ sources: obj.sources as Source[], domain: u.domain, intent: u.intent });
            } else if (obj.type === 'delta') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, content: last.content + String(obj.text || '') };
                return next;
              });
            } else if (obj.type === 'done') {
              update({ streaming: false });
            } else if (obj.type === 'error') {
              update({ streaming: false, error: true, content: `Ошибка: ${obj.message}` });
            }
          }
        }
        update({ streaming: false });
      } catch (e) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: e instanceof Error ? e.message : 'Не удалось получить ответ',
            streaming: false,
            error: true,
          };
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, messages],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <div className="mb-4">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Чат по документам ЛС и МИ
          </h1>
          <p className="text-sm text-muted-foreground">
            Ответы строго по нормативным документам (ЕАЭС / РК) со ссылками на источники. Можно спрашивать обычными
            словами.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="rounded-lg border bg-card p-6">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Примеры вопросов:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] ${m.role === 'user' ? 'order-1' : ''}`}>
                <div
                  className={[
                    'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : m.error
                        ? 'border border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border bg-card',
                  ].join(' ')}
                >
                  {m.role === 'assistant' && (m.domain || m.intent) && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {m.domain && (
                        <Badge variant="secondary" className="text-[10px]">
                          {m.domain === 'LS' ? 'ЛС' : m.domain === 'MI' ? 'МИ' : 'ЛС/МИ'}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {m.content ? renderAnswer(m.content) : null}
                    {m.streaming && (
                      <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <BookOpen className="h-3 w-3" /> Источники
                      </p>
                      <div className="space-y-1">
                        {m.sources.map((s) => {
                          const inner = (
                            <>
                              <span className="mr-1 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
                                {s.n}
                              </span>
                              {s.doc}
                              {s.heading ? ` — ${s.heading}` : ''}
                            </>
                          );
                          return s.document_id ? (
                            <Link
                              key={s.n}
                              href={`/reference/${s.document_id}`}
                              className="block text-xs text-muted-foreground hover:text-foreground hover:underline"
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div key={s.n} className="text-xs text-muted-foreground">
                              {inner}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {m.role === 'user' && (
                <div className="order-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 mt-2 border-t bg-background pt-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Спросите про регистрацию ЛС или МИ…"
              rows={1}
              className="max-h-32 min-h-11 resize-none"
              disabled={busy}
            />
            <Button onClick={() => send(input)} disabled={busy || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Ответы формируются по базе НПА. Проверяйте критичные решения по первоисточнику.
          </p>
        </div>
      </main>
    </div>
  );
}
