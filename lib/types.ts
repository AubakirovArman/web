export type Role = 'applicant' | 'expert' | 'admin';

export type Procedure = 'registration' | 're-registration' | 'variation';

export type ObjectType = 'LS' | 'MI';

export type ProductType =
  | 'original'
  | 'generic'
  | 'hybrid'
  | 'biological'
  | 'biosimilar';

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
}

export interface Parameter {
  id: string;
  label: string;
  type: 'select' | 'text' | 'multiselect' | 'boolean';
  options?: { value: string; label: string }[];
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

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  documentTypeId: string;
  contentType: string;
  extracted?: Record<string, string>;
  url?: string;
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
}
