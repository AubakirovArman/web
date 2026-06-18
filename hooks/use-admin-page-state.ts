'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRules } from '@/lib/hooks/useRules';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { useStore } from '@/lib/store';
import {
  type AdminNpaDraft,
  type AdminNpaRecord,
  type GemmaJobState,
  type NewDossierDocumentTypeEditorState,
  type NpaGemmaPreview,
  type NpaRequirementAction,
} from '@/lib/admin/admin-page-types';
import {
  applyNpaRequirementsToDocumentTypes,
  applyNpaRequirementsToNewDossierTypes,
  createBlankNpaDraft,
  guessRequirementTargetDocumentType,
  makeClientId,
  normalizeNpaRequirementsFromPreview,
} from '@/lib/admin/npa-logic';
import { mergeLsDossierDocumentTypesIntoCatalog } from '@/lib/admin/new-dossier-document-type-utils';

export function useAdminPageState() {
  const { rules, importRules } = useRules();
  const { store, hydrated, setDocumentTypes } = useStore();
  const documentTypes = store.documentTypes;
  const [adminConfigLoaded, setAdminConfigLoaded] = useState(false);
  const [newDossierDocumentTypesLoaded, setNewDossierDocumentTypesLoaded] = useState(false);
  const [newDossierDocumentTypes, setNewDossierDocumentTypes] = useState<NewDossierDocumentType[]>([]);
  const [newDossierDocumentTypeEditor, setNewDossierDocumentTypeEditor] = useState<NewDossierDocumentTypeEditorState | null>(null);
  const [npaRegistry, setNpaRegistry] = useState<AdminNpaRecord[]>([]);
  const [selectedNpaRecordId, setSelectedNpaRecordId] = useState<string | null>(null);
  const [npaDialogOpen, setNpaDialogOpen] = useState(false);
  const [npaDraft, setNpaDraft] = useState<AdminNpaDraft>(() => createBlankNpaDraft());
  const [npaExtractJob, setNpaExtractJob] = useState<GemmaJobState | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch('/api/admin/config')
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (cancelled || !config) return;
        if (Array.isArray(config.documentTypes)) {
          setDocumentTypes(config.documentTypes);
        }
        if (Array.isArray(config.rules)) {
          importRules(config.rules);
        }
        if (Array.isArray(config.lsDossierDocumentTypes)) {
          setNewDossierDocumentTypes(config.lsDossierDocumentTypes);
        }
        if (Array.isArray(config.npaRegistry)) {
          setNpaRegistry(config.npaRegistry);
        }
        setNewDossierDocumentTypesLoaded(true);
        setAdminConfigLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentTypes([]);
          importRules([]);
          setNewDossierDocumentTypes([]);
          setNpaRegistry([]);
          toast.error('База данных недоступна или admin-config не найден. Данные из JSON/localStorage не используются.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, importRules, setDocumentTypes]);

  useEffect(() => {
    if (!hydrated || !adminConfigLoaded || !newDossierDocumentTypesLoaded) return;
    setDocumentTypes(mergeLsDossierDocumentTypesIntoCatalog(documentTypes, newDossierDocumentTypes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, adminConfigLoaded, newDossierDocumentTypesLoaded, newDossierDocumentTypes]);

  useEffect(() => {
    if (!hydrated || !adminConfigLoaded || !newDossierDocumentTypesLoaded) return;
    const timer = window.setTimeout(() => {
      fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTypes,
          rules,
          lsDossierDocumentTypes: newDossierDocumentTypes,
          npaRegistry,
        }),
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hydrated, adminConfigLoaded, newDossierDocumentTypesLoaded, documentTypes, rules, newDossierDocumentTypes, npaRegistry]);

  const persistNewDossierDocumentTypes = (next: NewDossierDocumentType[]) => {
    setNewDossierDocumentTypes(next);
    setDocumentTypes(mergeLsDossierDocumentTypesIntoCatalog(documentTypes, next));
  };

  const handleResetNewDossierDocumentTypes = () => {
    fetch('/api/admin/config')
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось прочитать типы документов из БД');
        return response.json();
      })
      .then((config) => {
        const items = Array.isArray(config.lsDossierDocumentTypes) ? config.lsDossierDocumentTypes : [];
        persistNewDossierDocumentTypes(items);
        toast.success('Типы документов перечитаны из БД');
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Не удалось перечитать типы документов из БД');
      });
  };

  const persistNpaRegistry = (next: AdminNpaRecord[]) => {
    setNpaRegistry(next);
  };

  const openAddNpaDialog = () => {
    setNpaDraft(createBlankNpaDraft());
    setNpaExtractJob(null);
    setNpaDialogOpen(true);
  };

  const handleStartNpaExtraction = async () => {
    if (!npaDraft.name.trim()) {
      toast.error('Укажите наименование НПА');
      return;
    }
    if (!npaDraft.file) {
      toast.error('Прикрепите файл НПА');
      return;
    }

    setNpaExtractJob({
      title: npaDraft.name,
      stage: 'Подготовка файла и оценка размера документа',
      progress: 10,
      status: 'running',
    });
    const timer = window.setInterval(() => {
      setNpaExtractJob((job) => {
        if (!job || job.status !== 'running') return job;
        const nextProgress = Math.min(job.progress + 3, 88);
        return {
          ...job,
          progress: nextProgress,
          stage:
            nextProgress < 35
              ? 'Извлечение текста из Word/PDF'
              : nextProgress < 62
                ? 'Выбор режима анализа: весь документ или чанки'
                : 'Gemma извлекает только требования',
        };
      });
    }, 1200);

    try {
      const form = new FormData();
      form.append('file', npaDraft.file);
      form.append('name', npaDraft.name);
      form.append('actType', npaDraft.actType);
      form.append('number', npaDraft.number);
      form.append('date', npaDraft.date);
      form.append('revision', npaDraft.revision);

      const response = await fetch('/api/admin/npa-gemma-preview', {
        method: 'POST',
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось извлечь требования из НПА');
      }

      const preview = payload as NpaGemmaPreview;
      const requirements = normalizeNpaRequirementsFromPreview(preview).map((requirement) => ({
        ...requirement,
        targetDocumentTypeId: guessRequirementTargetDocumentType(requirement, documentTypes)?.id || '',
      }));
      setNpaDraft((current) => ({ ...current, requirements }));
      setNpaExtractJob({
        title: npaDraft.name,
        stage: `Извлечение завершено. Найдено требований: ${requirements.length}`,
        progress: 100,
        status: 'done',
      });
      toast.success(`Извлечено требований: ${requirements.length}`);
    } catch (error) {
      setNpaExtractJob({
        title: npaDraft.name,
        stage: 'Ошибка извлечения',
        progress: 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось извлечь требования из НПА',
      });
      toast.error(error instanceof Error ? error.message : 'Не удалось извлечь требования из НПА');
    } finally {
      window.clearInterval(timer);
    }
  };

  const handleUpdateDraftRequirementAction = (requirementId: string, action: NpaRequirementAction) => {
    setNpaDraft((current) => ({
      ...current,
      requirements: current.requirements.map((requirement) =>
        requirement.id === requirementId ? { ...requirement, action } : requirement,
      ),
    }));
  };

  const handleUpdateDraftRequirementTarget = (requirementId: string, targetDocumentTypeId: string) => {
    setNpaDraft((current) => ({
      ...current,
      requirements: current.requirements.map((requirement) =>
        requirement.id === requirementId ? { ...requirement, targetDocumentTypeId } : requirement,
      ),
    }));
  };

  const handleAcceptAllDraftRequirements = () => {
    setNpaDraft((current) => ({
      ...current,
      requirements: current.requirements.map((requirement) => ({ ...requirement, action: 'accepted' })),
    }));
  };

  const handleSaveNpaToRegistry = () => {
    if (!npaDraft.name.trim()) {
      toast.error('Укажите наименование НПА');
      return;
    }
    if (npaDraft.requirements.length === 0) {
      toast.error('Сначала запустите извлечение требований');
      return;
    }

    const record: AdminNpaRecord = {
      id: makeClientId('npa'),
      name: npaDraft.name.trim(),
      actType: npaDraft.actType,
      number: npaDraft.number.trim(),
      date: npaDraft.date,
      revision: npaDraft.revision.trim(),
      fileName: npaDraft.file?.name,
      fileSize: npaDraft.file?.size,
      requirements: npaDraft.requirements,
      createdAt: new Date().toISOString(),
    };
    persistNpaRegistry([record, ...npaRegistry]);
    const nextLsDossierDocumentTypes = applyNpaRequirementsToNewDossierTypes(record, newDossierDocumentTypes);
    if (nextLsDossierDocumentTypes.changed) {
      setNewDossierDocumentTypes(nextLsDossierDocumentTypes.items);
    }
    const baseCatalog = nextLsDossierDocumentTypes.changed
      ? mergeLsDossierDocumentTypesIntoCatalog(documentTypes, nextLsDossierDocumentTypes.items)
      : documentTypes;
    const imported = applyNpaRequirementsToDocumentTypes(record, baseCatalog);
    if (imported.count > 0) {
      setDocumentTypes(imported.documentTypes);
    }
    setSelectedNpaRecordId(record.id);
    setNpaDialogOpen(false);
    toast.success(
      imported.count > 0
        ? `НПА сохранен. Требований привязано к типам документов: ${imported.count}`
        : 'НПА сохранен в реестр'
    );
  };

  return {
    documentTypes,
    newDossierDocumentTypes,
    newDossierDocumentTypeEditor,
    npaRegistry,
    selectedNpaRecordId,
    npaDialogOpen,
    npaDraft,
    npaExtractJob,
    setSelectedNpaRecordId,
    setNpaDialogOpen,
    setNpaDraft,
    setNewDossierDocumentTypeEditor,
    persistNewDossierDocumentTypes,
    handleResetNewDossierDocumentTypes,
    openAddNpaDialog,
    handleStartNpaExtraction,
    handleUpdateDraftRequirementAction,
    handleUpdateDraftRequirementTarget,
    handleAcceptAllDraftRequirements,
    handleSaveNpaToRegistry,
  };
}
