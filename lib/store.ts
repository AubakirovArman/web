'use client';

import { useEffect, useState } from 'react';
import { Application, DocumentType, Finding, NPA, Parameter, Rule } from '@/lib/types';
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

function loadStore(): Store {
  if (typeof window === 'undefined') return initialStore;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialStore;
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      applications: parsed.applications || [],
      npas: parsed.npas || npas,
      documentTypes: parsed.documentTypes || documentTypes,
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
