import type {
  Application,
  DocumentRequirementCheckResult,
  DocumentType,
  DocumentTypeRequirement,
  UploadedFile,
} from '@/lib/types';

export type SupportedDocumentFormat =
  | 'pdf'
  | 'doc'
  | 'docx'
  | 'xls'
  | 'xlsx'
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'txt'
  | 'unknown';

export interface DocumentCheckCandidate {
  applicationId?: string;
  applicationValues?: Application['values'];
  file: UploadedFile;
  files?: UploadedFile[];
  bundleKey?: string;
  dossierSectionCode?: string;
  docType: DocumentType;
  requirements: DocumentTypeRequirement[];
}

export interface ExtractedDocumentContent {
  file: UploadedFile;
  format: SupportedDocumentFormat;
  text: string;
  imagePages?: DocumentImagePage[];
  quality: {
    hasText: boolean;
    textLength: number;
    imagePages?: number;
    extractionMethod: string;
  };
}

export interface DocumentImagePage {
  id: string;
  page: number;
  imageBase64: string;
  imageMime: string;
  sourceLabel: string;
}

export interface DocumentContentChunk {
  id: string;
  text: string;
  sourceLabel: string;
  index: number;
  total: number;
}

export interface DocumentCheckPipelineOptions {
  maxRequirementsPerChunk: number;
  maxTextCharsPerChunk: number;
}

export interface DocumentCheckPipelineResult {
  file: UploadedFile;
  docType: DocumentType;
  requirements: DocumentTypeRequirement[];
  extraction: ExtractedDocumentContent;
  chunks: DocumentContentChunk[];
  results: DocumentRequirementCheckResult[];
}

export interface DocumentTypesLoadResult {
  source: 'postgres' | 'admin';
  documentTypes: DocumentType[];
  databaseRulesCount?: number;
}

export interface DocumentTypesLoadInput {
  app: Application;
  adminDocumentTypes: DocumentType[];
}
