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

/** Требование, реально уходящее в Gemma при проверке (из condition_json). */
export interface GemmaCheckRequirement {
  id: string;
  /** required/conditional/cross — из document_check_profile; routing — из checker_routing. */
  kind: 'required' | 'conditional' | 'cross_document' | 'routing';
  /** Текст требования (check_text / requirement_text) — то, что читает Gemma. */
  text: string;
  title?: string;
  criticality?: string;
  passCriteria?: string;
  failureCriteria?: string;
  applicabilityCondition?: string;
  sourceReference?: string;
  /** 'npa' — требование добавлено привязкой из реестра НПА; иначе родное требование типа документа. */
  sourceScope?: string;
  /** id акта НПА, из которого пришло требование (если sourceScope='npa'). */
  npaId?: string;
  npaRequirementId?: string;
  /** Путь в condition_json для будущей записи правок. */
  path?: { array: string; index: number };
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
  /** Требования, реально уходящие в Gemma (из condition_json.document_check_profile + checker_routing). */
  checkProfileRequirements?: GemmaCheckRequirement[];
  checkIds?: string[];
  linkedApplicationParams?: string[];
  severityIfMissing?: 'critical' | 'serious' | 'warning' | 'unknown';
}

export const lsDossierDocumentTypesNew = data as NewDossierDocumentType[];
