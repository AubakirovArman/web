import data from '@/lib/data/generated/ls-dossier-document-types-new.json';
import type { ConditionNode } from '@/lib/types';

export type NewDossierDocumentKind = 'section' | 'document' | 'excluded';

export interface NewDossierRequirementSource {
  index: number;
  checkText: string;
  sourceReference: string;
  sourceStatus?: string;
  sourceTag?: string;
  sourceFiles?: string[];
  sourceNote?: string;
}

export interface NewDossierDocumentType {
  id: string;
  source: 'appendix-2' | 'appendix-3';
  sourceName: string;
  group: string;
  groupCode: string;
  module: string;
  code: string;
  name: string;
  description: string;
  kind: NewDossierDocumentKind;
  direction: 'LS' | 'MI';
  acceptedFormats: string[];
  active: boolean;
  sortOrder: number;
  requiredWhenExpression?: string;
  requiredWhenCondition?: ConditionNode;
  requirednessExplanation?: string;
  validationChecks?: string;
  npaReferences?: string[];
  requirementSources?: NewDossierRequirementSource[];
  checkIds?: string[];
  linkedApplicationParams?: string[];
  severityIfMissing?: 'critical' | 'serious' | 'warning' | 'unknown';
}

export const lsDossierDocumentTypesNew = data as NewDossierDocumentType[];
