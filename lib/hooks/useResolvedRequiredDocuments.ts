'use client';

import { useEffect, useMemo, useState } from 'react';
import { Application, DocumentType, RequiredDoc } from '@/lib/types';

interface ResolveResponse {
  requiredDocuments?: RequiredDoc[];
  documentTypes?: DocumentType[];
  databaseRulesCount?: number;
  matchedRulesCount?: number;
  diagnostics?: string[];
}

export function useResolvedRequiredDocuments(
  app: Application | undefined,
  legacyRequiredDocs: RequiredDoc[],
  baseDocumentTypesCatalog: DocumentType[],
) {
  const [dbRequiredDocs, setDbRequiredDocs] = useState<RequiredDoc[] | null>(null);
  const [dbDocumentTypes, setDbDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const valuesSignature = useMemo(() => JSON.stringify(app?.values || {}), [app?.values]);
  // Резолвим по scope любой заявки; если правил нет — ответ databaseRulesCount=0 и ниже fallback
  // (поведение для scope без правил сохраняется).
  const shouldResolveFromDb = Boolean(app?.values['param-object-type']);

  useEffect(() => {
    if (!app || !shouldResolveFromDb) {
      setDbRequiredDocs(null);
      setDbDocumentTypes([]);
      setDiagnostics([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch('/api/document-requirements/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: app.values }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
        return data as ResolveResponse;
      })
      .then((data) => {
        if (cancelled) return;
        if ((data.databaseRulesCount || 0) > 0 && Array.isArray(data.requiredDocuments)) {
          setDbRequiredDocs(data.requiredDocuments);
          setDbDocumentTypes(Array.isArray(data.documentTypes) ? data.documentTypes : []);
          setDiagnostics(data.diagnostics || []);
        } else {
          setDbRequiredDocs([]);
          setDbDocumentTypes([]);
          setDiagnostics(data.diagnostics || ['В Postgres нет правил документов для LS/registration. Локальный fallback отключен.']);
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        setDbRequiredDocs([]);
        setDbDocumentTypes([]);
        setDiagnostics([error?.message || 'Не удалось получить правила документов из Postgres. Локальный fallback отключен.']);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [app?.id, shouldResolveFromDb, valuesSignature]);

  const documentTypesCatalog = useMemo(
    () => shouldResolveFromDb
      ? dedupeDocumentTypes([...runtimeDbDocumentTypes(baseDocumentTypesCatalog), ...dbDocumentTypes])
      : mergeDocumentTypes(baseDocumentTypesCatalog, dbDocumentTypes),
    [baseDocumentTypesCatalog, dbDocumentTypes, shouldResolveFromDb],
  );

  return {
    requiredDocs: shouldResolveFromDb ? (dbRequiredDocs || []) : legacyRequiredDocs,
    documentTypesCatalog,
    loading,
    source: shouldResolveFromDb ? 'db' as const : 'legacy' as const,
    diagnostics,
  };
}

function runtimeDbDocumentTypes(documentTypes: DocumentType[]) {
  return documentTypes.filter((docType) =>
    docType.id.startsWith('memo-ls-') ||
    docType.direction === 'LS' && Boolean(docType.docCode && docType.sourceStructure)
  );
}

function mergeDocumentTypes(base: DocumentType[], extra: DocumentType[]) {
  if (!extra.length) return base;
  const byId = new Map<string, DocumentType>();
  for (const item of base) byId.set(item.id, item);
  for (const item of extra) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? mergeDocumentType(existing, item) : item);
  }
  return Array.from(byId.values());
}

function mergeDocumentType(base: DocumentType, extra: DocumentType): DocumentType {
  return {
    ...base,
    ...extra,
    name: base.name || extra.name,
    description: base.description || extra.description,
    acceptedFormats: base.acceptedFormats?.length ? base.acceptedFormats : extra.acceptedFormats,
    checkIds: Array.from(new Set([...(base.checkIds || []), ...(extra.checkIds || [])])),
    expectedExtractedFields: Array.from(new Set([...(base.expectedExtractedFields || []), ...(extra.expectedExtractedFields || [])])),
    importedRequirements: (extra.importedRequirements || []).length
      ? dedupeRequirements(extra.importedRequirements || [])
      : dedupeRequirements(base.importedRequirements || []),
    npaReferences: Array.from(new Set([...(base.npaReferences || []), ...(extra.npaReferences || [])])),
    requirednessExplanation: extra.requirednessExplanation || base.requirednessExplanation,
    requiredWhenExpression: extra.requiredWhenExpression || base.requiredWhenExpression,
    linkedApplicationParams: Array.from(new Set([...(base.linkedApplicationParams || []), ...(extra.linkedApplicationParams || [])])),
    validationChecksText: extra.validationChecksText || base.validationChecksText,
  };
}

function dedupeDocumentTypes(documentTypes: DocumentType[]) {
  const byId = new Map<string, DocumentType>();
  for (const item of documentTypes) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? mergeDocumentType(existing, item) : {
      ...item,
      importedRequirements: dedupeRequirements(item.importedRequirements || []),
    });
  }
  return Array.from(byId.values());
}

function dedupeRequirements(requirements: NonNullable<DocumentType['importedRequirements']>) {
  const byKey = new Map<string, NonNullable<DocumentType['importedRequirements']>[number]>();
  for (const requirement of requirements) {
    const key = [
      normalizeRequirementText(requirement.sourceDocumentCode),
      normalizeRequirementText(requirement.checkType),
      normalizeRequirementText(requirement.requirementText),
    ].join('|') || requirement.id;
    if (!byKey.has(key)) byKey.set(key, requirement);
  }
  return Array.from(byKey.values());
}

function normalizeRequirementText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/р/g, 'p')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();
}
