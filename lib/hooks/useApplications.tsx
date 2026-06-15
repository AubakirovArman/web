'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Application, Finding, UploadedFile } from '@/lib/types';
import { defaultApplicationValues } from '@/lib/data/seed';
import { demoFiles } from '@/lib/data/demoFiles';
import { runPreCheck } from '@/lib/checks';
import { getStoredRules } from '@/lib/rules/store';

const STORAGE_KEY = 'ndda-applications-v3';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createDemoApplication(): Application {
  const values = { ...defaultApplicationValues };
  const files: UploadedFile[] = demoFiles.map((f) => ({ ...f, id: uid() }));

  const app: Application = {
    id: uid(),
    createdAt: new Date().toISOString(),
    status: 'checked',
    values,
    files,
    checklist: [],
    findings: [],
  };

  app.findings = runPreCheck(app, getStoredRules());
  return app;
}

interface ApplicationContextValue {
  applications: Application[];
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  addApplication: () => Application;
  seedDemoApplication: () => Application;
  importApplication: (app: Application) => void;
  updateValues: (id: string, values: Partial<Application['values']>) => void;
  addFile: (id: string, file: Omit<UploadedFile, 'id'>) => void;
  removeFile: (id: string, fileId: string) => void;
  runCheck: (id: string) => void;
  updateFinding: (id: string, findingId: string, patch: Partial<Finding>) => void;
  submitApplication: (id: string) => void;
  updateStatus: (id: string, status: Application['status']) => void;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Application[];
        setApplications(parsed);
      } else {
        const demo = createDemoApplication();
        setApplications([demo]);
      }
    } catch {
      setApplications([createDemoApplication()]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    }
  }, [applications, loaded]);

  const updateApp = (id: string, updater: (app: Application) => Application) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? updater(a) : a)));
  };

  const value = useMemo<ApplicationContextValue>(
    () => ({
      applications,
      currentId,
      setCurrentId,
      addApplication: () => {
        const app = createDemoApplication();
        setApplications((prev) => [app, ...prev]);
        setCurrentId(app.id);
        return app;
      },
      seedDemoApplication: () => {
        const app = createDemoApplication();
        setApplications((prev) => [app, ...prev]);
        setCurrentId(app.id);
        return app;
      },
      importApplication: (app) => {
        setApplications((prev) => [app, ...prev]);
        setCurrentId(app.id);
      },
      updateValues: (id, values) =>
        updateApp(id, (app) => ({
          ...app,
          values: Object.fromEntries(
            Object.entries({ ...app.values, ...values }).filter(([, v]) => v !== undefined)
          ) as Application['values'],
          status: app.status === 'draft' ? 'draft' : app.status,
        })),
      addFile: (id, file) =>
        updateApp(id, (app) => ({
          ...app,
          files: [...app.files, { ...file, id: uid() }],
        })),
      removeFile: (id, fileId) =>
        updateApp(id, (app) => ({
          ...app,
          files: app.files.filter((f) => f.id !== fileId),
        })),
      runCheck: (id) =>
        updateApp(id, (app) => {
          const findings = runPreCheck(app, getStoredRules());
          return { ...app, status: 'checked', findings };
        }),
      updateFinding: (id, findingId, patch) =>
        updateApp(id, (app) => ({
          ...app,
          findings: app.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)),
        })),
      submitApplication: (id) =>
        updateApp(id, (app) => {
          const findings = runPreCheck(app, getStoredRules());
          return { ...app, status: 'submitted', findings };
        }),
      updateStatus: (id, status) =>
        updateApp(id, (app) => ({
          ...app,
          status,
        })),
    }),
    [applications, currentId]
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplications() {
  const ctx = useContext(ApplicationContext);
  if (!ctx) throw new Error('useApplications must be used within ApplicationProvider');
  return ctx;
}
