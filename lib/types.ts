export type Role = 'applicant' | 'expert' | 'admin';

export type Procedure = 'registration' | 're-registration' | 'variation';

export type ObjectType = 'LS' | 'MI';

export type ProductType =
  | 'original'
  | 'generic'
  | 'hybrid'
  | 'biological'
  | 'biosimilar'
  | 'vaccine'
  | 'herbal'
  | 'homeopathic'
  | 'radiopharmaceutical'
  | 'orphan'
  | 'blood'
  | 'well-established'
  | 'advanced-therapy';

export type Severity = 'critical' | 'serious' | 'warning' | 'unknown';

export interface NPA {
  id: string;
  name: string;
  number: string;
  date: string;
  direction: 'LS' | 'MI';
  status: 'active' | 'inactive';
}

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  acceptedFormats: string[];
  direction: 'LS' | 'MI' | 'both';
  requiredLanguages?: string[];
  isPhysicalSample?: boolean;
  needsOcr?: boolean;
  canCheckFont?: boolean;
  canCheckExpiry?: boolean;
  canCheckSignature?: boolean;
  canCheckSeal?: boolean;
  expectedExtractedFields?: string[];
  checkIds?: string[];
  npaReferences?: string[];
  requirednessExplanation?: string;
}

export interface Parameter {
  id: string;
  label: string;
  type: 'select' | 'text' | 'textarea' | 'date' | 'multiselect' | 'boolean';
  options?: { value: string; label: string }[];
  section?: string;
  sourceNpa?: string;
  sourceFieldRef?: string;
}

export interface RuleCondition {
  parameterId: string;
  operator: 'equals' | 'notEquals' | 'includes' | 'notEmpty';
  value?: string;
}

export interface RequiredDoc {
  documentTypeId: string;
  severityIfMissing: Severity;
  alternativeDocumentTypeId?: string;
  checks?: string[];
}

export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  requiredDocuments: RequiredDoc[];
  sourceNpaId?: string;
  active?: boolean;
}

export type ProcedureFieldsByObject = Record<Procedure, string[]>;

export interface ApplicationFormProfile {
  baseFields: string[];
  requiredFields: ProcedureFieldsByObject;
  procedureFields: ProcedureFieldsByObject;
}

export type ApplicationFormSchema = Record<ObjectType, ApplicationFormProfile>;

export type FileProcessingStatus =
  | 'queued'
  | 'extracting'
  | 'ocr-pending'
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped';

export interface FileProcessingMetadata {
  ocrStatus?: FileProcessingStatus;
  extractionStatus?: FileProcessingStatus;
  provider?: string;
  parser?: string;
  promptVersion?: string;
  startedAt?: string;
  finishedAt?: string;
  errors?: string[];
  textLayer?: boolean;
  ocrQuality?: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  documentTypeId: string;
  contentType: string;
  extracted?: Record<string, string>;
  url?: string;
  hash?: string;
  extension?: string;
  mime?: string;
  uploadedAt?: string;
  version?: number;
  language?: string;
  pageCount?: number;
  textLayer?: boolean;
  ocrQuality?: number;
  processing?: FileProcessingMetadata;
}

export type FindingStatus = 'open' | 'accepted' | 'rejected' | 'not-applicable' | 'resolved';

export interface FindingEvidence {
  source: string;
  text: string;
  field?: string;
  documentTypeId?: string;
  page?: number;
}

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  documents: string[];
  quotes?: { source: string; text: string }[];
  recommendation: string;
  npaReference?: string;
  accepted?: boolean | null;
  checkerId?: string;
  confidence?: number;
  status?: FindingStatus;
  evidence?: FindingEvidence[];
}

export type CheckMethod = 'rule' | 'parser' | 'ocr' | 'llm' | 'manual' | 'hybrid';

export interface CheckDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  method: CheckMethod;
  defaultSeverity: Severity;
  appliesTo: ('LS' | 'MI' | 'both')[];
  documentTypeIds?: string[];
  npaReferences?: string[];
  enabledByDefault?: boolean;
}

export interface Application {
  id: string;
  createdAt: string;
  status: 'draft' | 'submitted' | 'checking' | 'checked' | 'expert-review';
  values: Record<string, string | string[]>;
  files: UploadedFile[];
  checklist: ChecklistItem[];
  findings: Finding[];
}

export interface ChecklistItem {
  documentTypeId: string;
  required: boolean;
  uploaded: boolean;
  fileId?: string;
  severityIfMissing: Severity;
  alternativeDocumentTypeId?: string;
  matchedDocumentTypeId?: string;
  checks?: string[];
}
