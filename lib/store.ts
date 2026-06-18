'use client';

import { useEffect, useState } from 'react';
import { Application, DocumentType, DocumentTypeRequirement, Finding, NPA, Parameter, Rule } from '@/lib/types';
import { defaultApplicationValues, documentTypes, npas, parameters, rules } from '@/lib/data/seed';

const STORAGE_KEY = 'ndda-demo-store-v1';

export interface Store {
  applications: Application[];
  npas: NPA[];
  documentTypes: DocumentType[];
  parameters: Parameter[];
  rules: Rule[];
}

const initialStore: Store = {
  applications: [],
  npas,
  documentTypes,
  parameters,
  rules,
};

function uniqueList<T>(values: T[] = []): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeRequirements(
  seedRequirements: DocumentTypeRequirement[] = [],
  storedRequirements: DocumentTypeRequirement[] = [],
): DocumentTypeRequirement[] {
  const byId = new Map<string, DocumentTypeRequirement>();
  seedRequirements.forEach((requirement) => byId.set(requirementKey(requirement), requirement));
  storedRequirements.forEach((requirement) => byId.set(requirementKey(requirement), requirement));
  return Array.from(byId.values());
}

function requirementKey(requirement: DocumentTypeRequirement) {
  return [
    normalizeRequirementText(requirement.sourceDocumentCode),
    normalizeRequirementText(requirement.checkType),
    normalizeRequirementText(requirement.requirementText),
  ].join('|') || requirement.id;
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

function mergeDocumentTypesWithSeed(storedDocumentTypes?: DocumentType[] | null): DocumentType[] {
  if (!Array.isArray(storedDocumentTypes)) return documentTypes;

  const seedById = new Map(documentTypes.map((doc) => [doc.id, doc]));
  const storedById = new Map(storedDocumentTypes.map((doc) => [doc.id, doc]));

  const mergedSeedDocuments = documentTypes.map((seedDoc) => {
    const storedDoc = storedById.get(seedDoc.id);
    if (!storedDoc) return seedDoc;

    return {
      ...seedDoc,
      ...storedDoc,
      acceptedFormats: storedDoc.acceptedFormats?.length ? storedDoc.acceptedFormats : seedDoc.acceptedFormats,
      requiredLanguages: uniqueList([...(seedDoc.requiredLanguages || []), ...(storedDoc.requiredLanguages || [])]),
      expectedExtractedFields: uniqueList([
        ...(seedDoc.expectedExtractedFields || []),
        ...(storedDoc.expectedExtractedFields || []),
      ]),
      checkIds: uniqueList([...(seedDoc.checkIds || []), ...(storedDoc.checkIds || [])]),
      npaReferences: uniqueList([...(seedDoc.npaReferences || []), ...(storedDoc.npaReferences || [])]),
      importedRequirements: mergeRequirements(seedDoc.importedRequirements, storedDoc.importedRequirements),
      requirednessExplanation: storedDoc.requirednessExplanation || seedDoc.requirednessExplanation,
    };
  });

  const customDocuments = storedDocumentTypes.filter((doc) => !seedById.has(doc.id));
  return [...mergedSeedDocuments, ...customDocuments];
}

function loadStore(): Store {
  if (typeof window === 'undefined') return initialStore;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialStore;
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      applications: parsed.applications || [],
      npas: parsed.npas || npas,
      documentTypes: mergeDocumentTypesWithSeed(parsed.documentTypes),
      parameters: parsed.parameters || parameters,
      rules: parsed.rules || rules,
    };
  } catch {
    return initialStore;
  }
}

function saveStore(store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function useStore() {
  const [store, setStore] = useState<Store>(initialStore);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveStore(store);
  }, [store, hydrated]);

  const setApplications = (apps: Application[]) => setStore((s) => ({ ...s, applications: apps }));
  const addApplication = (app: Application) => setStore((s) => ({ ...s, applications: [app, ...s.applications] }));
  const updateApplication = (id: string, updater: (app: Application) => Application) =>
    setStore((s) => ({
      ...s,
      applications: s.applications.map((a) => (a.id === id ? updater(a) : a)),
    }));

  const setDocumentTypes = (dts: DocumentType[]) => setStore((s) => ({ ...s, documentTypes: dts }));
  const setRules = (rls: Rule[]) => setStore((s) => ({ ...s, rules: rls }));
  const setNpas = (n: NPA[]) => setStore((s) => ({ ...s, npas: n }));
  const setParameters = (p: Parameter[]) => setStore((s) => ({ ...s, parameters: p }));

  return {
    store,
    hydrated,
    setApplications,
    addApplication,
    updateApplication,
    setDocumentTypes,
    setRules,
    setNpas,
    setParameters,
  };
}

export { defaultApplicationValues, documentTypes, npas, parameters, rules };
