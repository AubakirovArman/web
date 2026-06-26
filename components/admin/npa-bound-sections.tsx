'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminNpaRecord } from '@/lib/admin/admin-page-types';
import type { DocumentType } from '@/lib/types';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { CheckProfileRequirementsEditor } from '@/components/admin/check-profile-requirements-editor';

/**
 * Требования привязанных разделов типа документа — то, что реально проверяет Gemma.
 * Правки здесь пишутся в общий document_check_profile (тот же источник, что и в типе документа).
 */
export function NpaBoundSections({
  record,
  documentTypes,
  onReload,
}: {
  record: AdminNpaRecord;
  documentTypes: DocumentType[];
  onReload?: () => void;
}) {
  const boundIds = Array.from(
    new Set(record.requirements.map((r) => r.targetDocumentTypeId).filter((v): v is string => Boolean(v))),
  );
  const [details, setDetails] = useState<Record<string, NewDossierDocumentType | null>>({});
  const [loading, setLoading] = useState(false);
  const key = boundIds.join(',');

  useEffect(() => {
    if (boundIds.length === 0) {
      setDetails({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const next: Record<string, NewDossierDocumentType | null> = {};
      await Promise.all(
        boundIds.map(async (id) => {
          try {
            const res = await fetch(`/api/admin/document-types/${encodeURIComponent(id)}`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            next[id] = data.item || null;
          } catch {
            next[id] = null;
          }
        }),
      );
      if (!cancelled) {
        setDetails(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (boundIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Требования привязанных разделов (идут в Gemma)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ни одно требование пока не привязано к разделу типа документа. Выберите тип документа в столбце
            «Тип документа системы» выше — текст требования уйдёт в проверку Gemma.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Требования привязанных разделов (идут в Gemma)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Это требования, которые проверяет Gemma в привязанных разделах. Редактирование здесь = редактирование
          в типе документа (общий источник). Текст типа документа — главный.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка разделов…
          </div>
        )}
        {boundIds.map((id) => {
          const detail = details[id];
          const doc = documentTypes.find((d) => d.id === id);
          const boundCount = record.requirements.filter((r) => r.targetDocumentTypeId === id).length;
          return (
            <div key={id} className="rounded-xl border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px] font-semibold">
                  {doc?.docCode || id}
                </Badge>
                <span className="font-medium">{detail?.name || doc?.name || id}</span>
                <Badge variant="secondary">{boundCount} привязано из этого НПА</Badge>
              </div>
              {detail ? (
                <CheckProfileRequirementsEditor
                  documentTypeId={id}
                  initial={detail.checkProfileRequirements || []}
                  onSaved={onReload}
                />
              ) : !loading ? (
                <p className="text-sm text-muted-foreground">Не удалось загрузить раздел.</p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
