import { CheckMethod, Finding, UploadedFile } from '@/lib/types';

export type ReviewStatus = 'passed' | 'failed' | 'warning' | 'skipped';
export type NpaFindingFilter = 'all' | Finding['severity'];

export interface ReviewCheckCell {
  id: string;
  name: string;
  status: ReviewStatus;
  method?: CheckMethod;
  severity?: Finding['severity'];
  findings: Finding[];
  description?: string;
  remark?: string;
  npaReferences?: string[];
}

export interface DocumentReviewRow {
  key: string;
  documentTypeId: string;
  name: string;
  required: boolean;
  severity?: Finding['severity'];
  formats: string[];
  file?: UploadedFile;
  files?: UploadedFile[];
  sectionCode?: string;
  bundleKey?: string;
  checks: ReviewCheckCell[];
  findings: Finding[];
  overall: ReviewStatus;
  ruleName?: string;
  conditionText?: string;
  alternativeName?: string;
}
