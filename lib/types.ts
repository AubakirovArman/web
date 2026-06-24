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

export interface DocumentTypeRequirement {
  id: string;
  source: 'gemma' | 'manual';
  previewId?: string;
  sourceDocumentCode?: string;
  sourceDocumentName?: string;
  procedure?: string;
  checkSubject?: string;
  checkType?: string;
  requirementText: string;
  criticality?: string;
  applicabilityCondition?: string;
  sourcePoint?: string;
  quote?: string;
  importedAt?: string;
  checkerMode?: string;
  checkTarget?: string[];
  linkedApplicationFields?: string[];
  missingApplicationFields?: string[];
  relatedDocumentCodes?: string[];
  expectedCheckerInputs?: string[];
  applicabilityGateRequired?: boolean;
  aggregateByDossierSectionCode?: boolean;
  decisionLogic?: string;
}

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  docCode?: string;
  modulePart?: string;
  sourceStructure?: string;
  dossierVariant?: string;
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
  requiredWhenExpression?: string;
  /** Структурированный предикат обязательности (из condition_json). Приоритетнее текстового requiredWhenExpression. */
  requiredWhenCondition?: ConditionNode;
  linkedApplicationParams?: string[];
  severityIfMissing?: Severity;
  validationChecksText?: string;
  importedRequirements?: DocumentTypeRequirement[];
}

/**
 * Дерево условия обязательности документа (DSL из condition_json НПА-правил).
 * Листья: eq/neq (равенство значения поля), in (значение в списке),
 * not_empty (поле заполнено), contains (поле содержит подстроку/значение).
 * Узлы: all (И), any (ИЛИ).
 */
export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { eq: [string, string] }
  | { neq: [string, string] }
  | { in: [string, string[]] }
  | { not_empty: [string] }
  | { contains: [string, string] };

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

export interface RuleSource {
  npaId?: string;
  sourceDocumentId?: string;
  sourceSection?: string;
  sourceQuote?: string;
  sourcePage?: number;
  sourceAnchor?: string;
  explanation?: string;
}

export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  requiredDocuments: RequiredDoc[];
  sourceNpaId?: string;
  sources?: RuleSource[];
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
  pageCount?: number;
  imagePages?: number;
  textChars?: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  documentTypeId: string;
  contentType: string;
  source?: 'manual' | 'demo' | 'dossier-folder';
  originalName?: string;
  relativePath?: string;
  dossierSectionId?: string;
  dossierSectionCode?: string;
  dossierSectionCodeAliases?: string[];
  dossierSectionName?: string;
  dossierFolderName?: string;
  dossierMappingConfidence?: number;
  dossierMappingReason?: string;
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
  npaRequirementResults?: DocumentRequirementCheckResult[];
}

export type DocumentRequirementCheckStatus = 'passed' | 'failed' | 'uncertain' | 'not_applicable' | 'skipped';

export interface DocumentRequirementCheckResult {
  requirementId: string;
  status: DocumentRequirementCheckStatus;
  requirementText?: string;
  evidence?: string;
  comment?: string;
  confidence?: number;
  checkedAt: string;
  provider?: string;
  sourcePoint?: string;
  bundleKey?: string;
  dossierSectionCode?: string;
  documentTypeId?: string;
  fileIds?: string[];
  fileNames?: string[];
  coverage?: 'single_file' | 'multi_file' | 'none';
}

export type FindingStatus =
  | 'open'
  | 'accepted'
  | 'rejected'
  | 'false-positive'
  | 'needs-clarification'
  | 'not-applicable'
  | 'resolved';

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

export type ReferenceDocumentKind = 'order' | 'decision' | 'agreement' | 'code' | 'form' | 'classifier' | 'dossier' | 'other';

export interface ReferenceSection {
  id: string;
  title: string;
  level: number;
  anchor: string;
  text: string;
  rawText?: string;
  formattedText?: string;
  formatter?: 'gemma' | 'raw' | 'raw_empty_gemma' | 'raw_safety_short_gemma' | 'gemma_error';
  headingNumber?: string;
  sectionType?: string;
  rawCharCount?: number;
  page?: number;
}

export interface ReferenceDocument {
  id: string;
  domain: 'LS' | 'MI';
  title: string;
  fileName: string;
  sourcePath?: string;
  kind: ReferenceDocumentKind;
  number?: string;
  date?: string;
  tags: string[];
  markdownPath: string;
  sections: ReferenceSection[];
}

export interface ReferenceSearchItem {
  documentId: string;
  domain: 'LS' | 'MI';
  title: string;
  sectionId?: string;
  sectionTitle?: string;
  text: string;
  tags: string[];
  anchor?: string;
}

export interface ExpertCheckDecision {
  status: 'passed' | 'failed';
  comment?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface Application {
  id: string;
  createdAt: string;
  status: 'draft' | 'submitted' | 'checking' | 'checked' | 'expert-review';
  values: Record<string, string | string[]>;
  files: UploadedFile[];
  checklist: ChecklistItem[];
  findings: Finding[];
  // Решения эксперта по отдельным проверкам: ключ = `${rowKey}::${checkId}`
  expertCheckDecisions?: Record<string, ExpertCheckDecision>;
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
