'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Application, ExpertCheckDecision, Finding, UploadedFile } from '@/lib/types';
import { defaultApplicationValues } from '@/lib/data/seed';
import { demoFiles } from '@/lib/data/demoFiles';
import { runPreCheck, runSubmissionValidation } from '@/lib/checks';
import { getStoredRules } from '@/lib/rules/store';

const APPLICATIONS_API = '/api/applications';
const APPLICATIONS_CLIENT_VERSION = 'postgres-only-v2';
type UploadInput = Omit<UploadedFile, 'id'> & Partial<Pick<UploadedFile, 'id'>>;

const validStatuses: Application['status'][] = ['draft', 'submitted', 'checking', 'checked', 'expert-review'];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createDemoApplication(): Application {
  const values = { ...defaultApplicationValues };
  const files: UploadedFile[] = demoFiles.map((f) => ({ ...f, id: uid() }));

  const app: Application = {
    id: uid(),
    createdAt: new Date().toISOString(),
    status: 'draft',
    values,
    files,
    checklist: [],
    findings: [],
  };

  app.findings = runPreCheck(app, getStoredRules());
  return app;
}

// Чистый черновик новой заявки: только структурные параметры маршрутизации,
// без демо-файлов и без заполненных данных продукта — заявитель заполняет сам.
function createBlankApplication(): Application {
  const values: Application['values'] = {
    'param-object-type': 'LS',
    'param-procedure': 'registration',
    'param-dossier-type': 'ctd',
    'param-expertise-mode': 'standard',
    'param-product-type': 'generic',
  };

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    status: 'draft',
    values,
    files: [],
    checklist: [],
    findings: [],
    expertCheckDecisions: {},
  };
}

function normalizeApplication(app: Partial<Application>): Application {
  const status = validStatuses.includes(app.status as Application['status'])
    ? (app.status as Application['status'])
    : 'draft';

  return {
    id: app.id || uid(),
    createdAt: app.createdAt || new Date().toISOString(),
    status,
    values: {
      ...defaultApplicationValues,
      ...(app.values || {}),
    },
    files: Array.isArray(app.files) ? app.files : [],
    checklist: Array.isArray(app.checklist) ? app.checklist : [],
    findings: Array.isArray(app.findings) ? app.findings : [],
    expertCheckDecisions: app.expertCheckDecisions && typeof app.expertCheckDecisions === 'object'
      ? app.expertCheckDecisions
      : {},
  };
}

async function fetchServerApplications(retries = 3): Promise<Application[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(APPLICATIONS_API, { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить серверные заявки');
      const data = await response.json();
      const applications = data?.applications;
      return Array.isArray(applications) ? applications.map(normalizeApplication) : [];
    } catch (error) {
      lastError = error;
      // Транзиентный сбой (часто — первый запрос после рестарта сервиса):
      // ждём и пробуем снова, прежде чем показывать ошибку пользователю.
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Не удалось загрузить серверные заявки');
}

async function saveServerApplication(application: Application) {
  const response = await fetch(APPLICATIONS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ndda-client-version': APPLICATIONS_CLIENT_VERSION },
    body: JSON.stringify({ application }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Не удалось сохранить заявку (${response.status})`);
  }
}

async function patchServerFinding(id: string, findingId: string, patch: Partial<Finding>): Promise<Application | null> {
  const response = await fetch(`${APPLICATIONS_API}/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch }),
  });

  if (!response.ok) throw new Error('Не удалось сохранить статус замечания');
  const data = await response.json();
  return data?.application ? normalizeApplication(data.application) : null;
}

async function deleteServerApplication(id: string): Promise<void> {
  const response = await fetch(`${APPLICATIONS_API}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Не удалось удалить заявку');
}

async function createServerTestSubmission(id: string): Promise<Application | null> {
  const response = await fetch(`${APPLICATIONS_API}/${encodeURIComponent(id)}/test-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Не удалось создать тестовую заявку');
  return data?.application ? normalizeApplication(data.application) : null;
}

interface ApplicationContextValue {
  applications: Application[];
  isLoading: boolean;
  loadError: string | null;
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  addApplication: () => Application;
  createApplication: () => Application;
  seedDemoApplication: () => Application;
  importApplication: (app: Application) => void;
  deleteApplication: (id: string) => Promise<void>;
  updateValues: (id: string, values: Partial<Application['values']>) => void;
  addFile: (id: string, file: UploadInput) => void;
  addFiles: (id: string, files: UploadInput[]) => void;
  removeFile: (id: string, fileId: string) => void;
  removeFiles: (id: string, fileIds: string[]) => void;
  runCheck: (id: string) => void;
  updateFinding: (id: string, findingId: string, patch: Partial<Finding>) => void;
  setCheckDecision: (id: string, checkKey: string, decision: ExpertCheckDecision | null) => void;
  submitApplication: (id: string) => {
    success: boolean;
    findings: Finding[];
    blockingFindings: Finding[];
  };
  createTestSubmissionCopy: (id: string) => Promise<Application | null>;
  updateStatus: (id: string, status: Application['status']) => void;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadApplications = async () => {
      setIsLoading(true);
      setLoadError(null);
      const initial = await fetchServerApplications();

      if (cancelled) return;

      setApplications(initial);
      setCurrentId((current) => current || initial[0]?.id || null);
      setIsLoading(false);
    };

    void loadApplications().catch((error) => {
      if (cancelled) return;
      setApplications([]);
      setCurrentId(null);
      setIsLoading(false);
      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить заявки');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateApp = (id: string, updater: (app: Application) => Application, persist = true) => {
    setApplications((prev) => {
      let updated: Application | null = null;
      const next = prev.map((a) => {
        if (a.id !== id) return a;
        updated = updater(a);
        return updated;
      });
      if (persist && updated) {
        void saveServerApplication(updated).catch((error) => console.warn(error));
      }
      return next;
    });
  };
  const toEditableStatus = (status: Application['status']): Application['status'] =>
    status === 'submitted' || status === 'expert-review' ? status : 'draft';

  const value = useMemo<ApplicationContextValue>(
    () => ({
      applications,
      isLoading,
      loadError,
      currentId,
      setCurrentId,
      addApplication: () => {
        const app = createDemoApplication();
        setApplications((prev) => [app, ...prev]);
        setCurrentId(app.id);
        void saveServerApplication(app).catch((error) => console.warn(error));
        return app;
      },
      createApplication: () => {
        const app = createBlankApplication();
        setApplications((prev) => [app, ...prev]);
        setCurrentId(app.id);
        void saveServerApplication(app).catch((error) => console.warn(error));
        return app;
      },
      seedDemoApplication: () => {
        const app = createDemoApplication();
        setApplications((prev) => [app, ...prev]);
        setCurrentId(app.id);
        void saveServerApplication(app).catch((error) => console.warn(error));
        return app;
      },
      importApplication: (app) => {
        const normalized = normalizeApplication(app);
        setApplications((prev) =>
          prev.some((item) => item.id === normalized.id)
            ? prev.map((item) => (item.id === normalized.id ? normalized : item))
            : [normalized, ...prev]
        );
        setCurrentId(normalized.id);
      },
      deleteApplication: async (id) => {
        await deleteServerApplication(id);
        setApplications((prev) => prev.filter((app) => app.id !== id));
        setCurrentId((current) => (current === id ? null : current));
      },
      updateValues: (id, values) =>
        updateApp(id, (app) => ({
          ...app,
          values: Object.fromEntries(
            Object.entries({ ...app.values, ...values }).filter(([, v]) => v !== undefined)
          ) as Application['values'],
          status: toEditableStatus(app.status),
        })),
      addFile: (id, file) =>
        updateApp(id, (app) => ({
          ...app,
          files: [...app.files, { ...file, id: file.id || uid() }],
          status: toEditableStatus(app.status),
        })),
      addFiles: (id, files) =>
        updateApp(id, (app) => ({
          ...app,
          files: [...app.files, ...files.map((file) => ({ ...file, id: file.id || uid() }))],
          status: toEditableStatus(app.status),
        })),
      removeFile: (id, fileId) =>
        updateApp(id, (app) => ({
          ...app,
          files: app.files.filter((f) => f.id !== fileId),
          status: toEditableStatus(app.status),
        })),
      removeFiles: (id, fileIds) =>
        updateApp(id, (app) => {
          const remove = new Set(fileIds);
          return {
            ...app,
            files: app.files.filter((f) => !remove.has(f.id)),
            status: toEditableStatus(app.status),
          };
        }),
      runCheck: (id) =>
        updateApp(id, (app) => {
          const findings = runPreCheck(app, getStoredRules());
          const status =
            app.status === 'submitted' || app.status === 'expert-review'
              ? app.status
              : 'checked';
          return { ...app, status, findings };
        }),
      setCheckDecision: (id, checkKey, decision) =>
        updateApp(id, (app) => {
          const current = { ...(app.expertCheckDecisions || {}) };
          if (decision) {
            current[checkKey] = decision;
          } else {
            delete current[checkKey];
          }
          return { ...app, expertCheckDecisions: current };
        }),
      updateFinding: (id, findingId, patch) =>
        {
          updateApp(id, (app) => ({
            ...app,
            findings: app.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)),
          }), false);
          void patchServerFinding(id, findingId, patch)
            .then((serverApp) => {
              if (!serverApp) return;
              setApplications((prev) =>
                prev.map((item) => (item.id === serverApp.id ? serverApp : item))
              );
            })
            .catch((error) => {
              console.warn(error);
            });
        },
      submitApplication: (id) => {
        const app = applications.find((item) => item.id === id);
        if (!app) {
          return { success: false, findings: [], blockingFindings: [] };
        }

        const { findings, blockingFindings, success } = runSubmissionValidation(app, getStoredRules());
        if (!success) {
          updateApp(id, (stored) => ({
            ...stored,
            status: 'checked',
            findings,
          }));
          return { success: false, findings, blockingFindings };
        }

        updateApp(id, (stored) => ({
          ...stored,
          status: 'submitted',
          findings,
        }));
        return { success: true, findings, blockingFindings };
      },
      createTestSubmissionCopy: async (id) => {
        const copy = await createServerTestSubmission(id);
        if (!copy) return null;
        setApplications((prev) =>
          prev.some((item) => item.id === copy.id)
            ? prev.map((item) => (item.id === copy.id ? copy : item))
            : [copy, ...prev]
        );
        setCurrentId(copy.id);
        return copy;
      },
      updateStatus: (id, status) =>
        updateApp(id, (app) => ({
          ...app,
          status,
        })),
    }),
    [applications, currentId, isLoading, loadError]
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplications() {
  const ctx = useContext(ApplicationContext);
  if (!ctx) throw new Error('useApplications must be used within ApplicationProvider');
  return ctx;
}
