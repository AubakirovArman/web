'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2, Link2Off, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';
import { DocumentTypeCombobox } from '@/components/admin/document-type-combobox';
import type { AdminNpaRequirement } from '@/lib/admin/admin-page-types';
import type { DocumentType } from '@/lib/types';

type StatusFilter = 'all' | 'bound' | 'unbound';

function cleanCheckType(value?: string): string {
  return (value || '').replace(/^\s*gemma\s*[:\-–—]?\s*/i, '').trim();
}

export function NpaRequirementBindingList({
  record,
  documentTypes,
  onBind,
}: {
  record: { requirements: AdminNpaRequirement[] };
  documentTypes: DocumentType[];
  onBind: (requirementId: string, targetDocumentTypeId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [unbindReq, setUnbindReq] = useState<AdminNpaRequirement | null>(null);
  const PAGE = 60;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [query, filter]);

  const docById = useMemo(() => new Map(documentTypes.map((d) => [d.id, d])), [documentTypes]);
  const recentIds = useMemo(
    () => Array.from(new Set(record.requirements.map((r) => r.targetDocumentTypeId).filter(Boolean))) as string[],
    [record.requirements],
  );

  const boundCount = record.requirements.filter((r) => r.targetDocumentTypeId).length;
  const total = record.requirements.length;
  const unboundCount = total - boundCount;

  const q = query.trim().toLowerCase();
  const rows = record.requirements.filter((r) => {
    if (filter === 'bound' && !r.targetDocumentTypeId) return false;
    if (filter === 'unbound' && r.targetDocumentTypeId) return false;
    if (!q) return true;
    return [r.requirement, r.code, r.pointLabel, r.point, r.documentName]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const Chip = ({ value, label }: { value: StatusFilter; label: string }) => (
    <Button
      variant={filter === value ? 'secondary' : 'outline'}
      size="sm"
      className="h-8"
      onClick={() => setFilter(value)}
    >
      {label}
    </Button>
  );

  return (
    <div className="space-y-3">
      {/* Тулбар: поиск + фильтр статуса + счётчики */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти требование, код, пункт…"
          className="h-9 sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip value="all" label={`Все · ${total}`} />
          <Chip value="bound" label={`Привязаны · ${boundCount}`} />
          <Chip value="unbound" label={`Не привязаны · ${unboundCount}`} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyAdminBlock text="Ничего не найдено по фильтру." />
      ) : (
        <div className="space-y-2">
          {rows.slice(0, visible).map((req) => {
            const doc = req.targetDocumentTypeId ? docById.get(req.targetDocumentTypeId) : undefined;
            const isBound = Boolean(req.targetDocumentTypeId);
            const from = req.pointLabel || req.point;
            const npaDoc = [req.documentName, req.documentCode, cleanCheckType(req.checkType)].filter(Boolean).join(' · ');
            return (
              <div key={req.id} className="rounded-xl border bg-card p-3">
                {/* Требование + откуда */}
                <div className="text-sm leading-6">{req.requirement}</div>
                {from && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70">Из пункта:</span> {from}
                  </div>
                )}

                {/* Зона привязки: статус-бейдж + название + действия */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
                  {isBound ? (
                    <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">
                      <Link2 className="h-3.5 w-3.5" />
                      Привязано →
                      <span className="font-mono font-semibold">{doc?.docCode || req.targetDocumentTypeId}</span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                    >
                      <Link2Off className="h-3.5 w-3.5" />
                      Не привязано
                    </Badge>
                  )}
                  {isBound && doc?.name && (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={doc.name}>
                      {doc.name}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <DocumentTypeCombobox
                      documentTypes={documentTypes}
                      value={req.targetDocumentTypeId}
                      recentIds={recentIds}
                      triggerLabel={isBound ? 'Перепривязать' : 'Привязать к разделу'}
                      onSelect={(docId) => onBind(req.id, docId)}
                    />
                    {isBound && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => setUnbindReq(req)}
                      >
                        Отвязать
                      </Button>
                    )}
                  </div>
                </div>

                {/* Детали из НПА — свёрнуто */}
                {(req.quote || req.condition || npaDoc) && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-foreground/80">
                      <Quote className="h-3.5 w-3.5" />
                      Детали из НПА
                    </summary>
                    <div className="mt-2 space-y-1.5 border-l-2 pl-3">
                      {npaDoc && (
                        <div>
                          <span className="text-muted-foreground/70">Документ / проверка:</span> {npaDoc}
                        </div>
                      )}
                      {req.condition && (
                        <div>
                          <span className="text-muted-foreground/70">Условие:</span> {req.condition}
                        </div>
                      )}
                      {req.quote && (
                        <div>
                          <span className="text-muted-foreground/70">Цитата:</span> {req.quote}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
          {rows.length > visible && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">
                Показано {visible} из {rows.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                Показать ещё {Math.min(PAGE, rows.length - visible)}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Подтверждение отвязки */}
      <Dialog open={Boolean(unbindReq)} onOpenChange={(o) => !o && setUnbindReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отвязать требование от раздела?</DialogTitle>
            <DialogDescription>
              Требование перестанет проверяться Gemma в разделе{' '}
              <span className="font-mono font-semibold">
                {unbindReq?.targetDocumentTypeId ? docById.get(unbindReq.targetDocumentTypeId)?.docCode || unbindReq.targetDocumentTypeId : ''}
              </span>
              . Текст требования в НПА сохранится — можно привязать снова.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnbindReq(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (unbindReq) onBind(unbindReq.id, '');
                setUnbindReq(null);
              }}
            >
              Отвязать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
