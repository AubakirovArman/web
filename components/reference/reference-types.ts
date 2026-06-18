export type ExperimentStatus = 'processed' | 'pending' | 'error';

export interface IntelligenceSummary {
  short: string;
  detailed: string;
  project_relevance: string;
  regulated_scope: string;
}

export interface IntelligenceItem {
  [key: string]: unknown;
}

export interface ReferenceExperimentSection {
  id: string;
  title: string;
  level: number;
  anchor: string;
  sectionType: string;
  headingNumber?: string;
  text: string;
  rawCharCount?: number;
}

export interface ReferenceExperimentDocument {
  id: string;
  domain: 'LS' | 'MI';
  title: string;
  fileName: string;
  sourcePath?: string;
  kind: string;
  number?: string;
  date?: string;
  tags: string[];
  tokenEstimate: number;
  charCount: number;
  sectionsCount: number;
  status: ExperimentStatus;
  error?: string;
  processedAt?: string;
  promptVersion?: string;
  sections: ReferenceExperimentSection[];
  intelligence?: {
    summary: IntelligenceSummary;
    key_points: IntelligenceItem[];
    procedures: IntelligenceItem[];
    document_types: IntelligenceItem[];
    requirements: IntelligenceItem[];
    applicant_parameters: IntelligenceItem[];
    dependencies: IntelligenceItem[];
    checks: IntelligenceItem[];
    highlights: IntelligenceItem[];
    quality_notes: string[];
    meta?: Record<string, unknown>;
  };
}

export interface ReferenceExperimentData {
  generatedAt: string;
  promptVersion: string;
  model: string | null;
  mode: string;
  processedCount: number;
  targetCount: number;
  sort: string;
  note: string;
  documents: ReferenceExperimentDocument[];
}
