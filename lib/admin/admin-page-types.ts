import type { Severity } from '@/lib/types';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import type { DocumentType } from '@/lib/types';

export const NEW_DOSSIER_DOC_TYPES_STORAGE_KEY = 'ndda-ls-dossier-document-types-new-v1';
export const NPA_REGISTRY_STORAGE_KEY = 'ndda-admin-npa-registry-v1';

export const npaActTypeOptions = [
  'Приказ',
  'Решение Совета ЕЭК',
  'Решение Коллегии ЕЭК',
  'Кодекс РК',
  'Иное',
];

export const severityLabels: Record<Severity, string> = {
  critical: 'Критично',
  serious: 'Серьезно',
  warning: 'Предупреждение',
  unknown: 'Неизвестно',
};

export interface NpaGemmaPreview {
  previewId: string;
  promptVersion: string;
  sourceKind?: 'reference' | 'upload';
  createdAt?: string;
  document: {
    id: string;
    title: string;
    domain: string;
    fileName: string;
    number?: string | null;
    date?: string | null;
    sectionsTotal: number;
    payloadChars: number;
    sampleSections: Array<{
      id: string;
      type?: string | null;
      number?: string | null;
      title?: string | null;
      text: string;
    }>;
  };
  extraction: {
    area: string;
    act?: Record<string, unknown>;
    procedures: string[];
    document_types: Record<string, unknown>[];
    requirements: Record<string, unknown>[];
    change_types: Record<string, unknown>[];
    applicant_parameters: Record<string, unknown>[];
    parameter_groups: Record<string, unknown>[];
    parameter_dependencies: Record<string, unknown>[];
    quality_notes: string[];
    meta?: Record<string, unknown>;
  };
  summary: {
    area: string;
    procedures: string[];
    document_types: number;
    requirements: number;
    applicant_parameters: number;
    parameter_groups: number;
    parameter_dependencies: number;
    change_types: number;
  };
}

export interface GemmaJobState {
  title: string;
  stage: string;
  progress: number;
  status: 'running' | 'done' | 'error';
  error?: string;
}

export type NpaRequirementAction = 'accepted' | 'rejected';

export interface AdminNpaRequirement {
  id: string;
  code: string;
  point: string;
  requirement: string;
  criticality: string;
  action: NpaRequirementAction;
  documentCode: string;
  documentName: string;
  checkType: string;
  condition: string;
  quote: string;
  targetDocumentTypeId?: string;
  /** id записи в document_check_profile привязанного раздела (двусторонняя связь). */
  targetRequirementId?: string;
  // Injected when requirements are listed across the whole registry:
  npaId?: string;
  npaName?: string;
  npaShortName?: string;
  /** Point enriched with the source act name, e.g. "Решение № 88 п. 2". */
  pointLabel?: string;
}

export interface AdminNpaRecord {
  id: string;
  name: string;
  actType: string;
  number: string;
  date: string;
  revision: string;
  fileName?: string;
  fileSize?: number;
  area?: string;
  requirements: AdminNpaRequirement[];
  createdAt: string;
}

export interface AdminNpaDraft {
  name: string;
  actType: string;
  number: string;
  date: string;
  revision: string;
  file: File | null;
  requirements: AdminNpaRequirement[];
}

export interface DocumentTypeEditorState {
  mode: 'create' | 'edit';
  values: DocumentType;
}

export interface NewDossierDocumentTypeEditorState {
  mode: 'create' | 'edit';
  values: NewDossierDocumentType;
}
