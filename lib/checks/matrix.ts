import { Application, ObjectType, Procedure, Rule, RuleCondition, Severity } from '@/lib/types';
import { checkDefinitions } from '@/lib/checks/registry';
import { documentTypes, rules as seedRules } from '@/lib/data/seed';

export interface ApplicationCheckMatrixRow {
  objectType: ObjectType;
  procedure: Procedure;
  ruleId: string;
  ruleName: string;
  conditions: RuleCondition[];
  documentTypeId: string;
  documentName: string;
  alternativeDocumentTypeId?: string;
  alternativeDocumentName?: string;
  severityIfMissing: Severity;
  acceptedFormats: string[];
  checkIds: string[];
  checkNames: string[];
  runnerMethods: string[];
  npaReferences: string[];
}

export function buildApplicationCheckMatrix(
  app: Application,
  rules: Rule[] = seedRules,
): ApplicationCheckMatrixRow[] {
  const objectType = app.values['param-object-type'] === 'MI' ? 'MI' : 'LS';
  const procedure = normalizeProcedure(app.values['param-procedure']);

  return rules
    .filter((rule) => rule.active !== false && matchesConditions(app.values, rule.conditions))
    .flatMap((rule) =>
      rule.requiredDocuments.map((requiredDocument) => {
        const documentType = documentTypes.find((doc) => doc.id === requiredDocument.documentTypeId);
        const alternativeDocumentType = requiredDocument.alternativeDocumentTypeId
          ? documentTypes.find((doc) => doc.id === requiredDocument.alternativeDocumentTypeId)
          : undefined;
        const checkIds = unique([
          'required_document_presence_check',
          'file_format_check',
          'ocr_quality_check',
          ...(requiredDocument.checks || []),
          ...(documentType?.checkIds || []),
        ]);
        const definitions = checkIds.map((checkId) => checkDefinitions.find((definition) => definition.id === checkId));

        return {
          objectType,
          procedure,
          ruleId: rule.id,
          ruleName: rule.name,
          conditions: rule.conditions,
          documentTypeId: requiredDocument.documentTypeId,
          documentName: documentType?.name || requiredDocument.documentTypeId,
          alternativeDocumentTypeId: requiredDocument.alternativeDocumentTypeId,
          alternativeDocumentName: alternativeDocumentType?.name,
          severityIfMissing: requiredDocument.severityIfMissing,
          acceptedFormats: documentType?.acceptedFormats || [],
          checkIds,
          checkNames: definitions.map((definition, index) => definition?.name || checkIds[index]),
          runnerMethods: unique(definitions.map((definition) => definition?.method || 'manual')),
          npaReferences: unique([
            ...(documentType?.npaReferences || []),
            ...definitions.flatMap((definition) => definition?.npaReferences || []),
          ]),
        } satisfies ApplicationCheckMatrixRow;
      }),
    );
}

export function buildProcedureCheckMatrix(
  objectType: ObjectType,
  procedure: Procedure,
  rules: Rule[] = seedRules,
): ApplicationCheckMatrixRow[] {
  const app: Application = {
    id: 'matrix-preview',
    createdAt: new Date().toISOString(),
    status: 'draft',
    values: {
      'param-object-type': objectType,
      'param-procedure': procedure,
      'param-product-type': 'generic',
      'param-lab-testing-required': 'yes',
      'param-sterile': 'no',
      'param-mi-risk-class': 'IIa',
      'param-mi-sterile': 'no',
      'param-mi-ivd': 'no',
      'param-mi-implantable': 'no',
    },
    files: [],
    checklist: [],
    findings: [],
  };

  return buildApplicationCheckMatrix(app, rules);
}

function normalizeProcedure(value: Application['values'][string]): Procedure {
  return value === 're-registration' || value === 'variation' ? value : 'registration';
}

function matchesConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((condition) => {
    const value = values[condition.parameterId];
    const target = condition.value;
    switch (condition.operator) {
      case 'equals':
        return value === target;
      case 'notEquals':
        return value !== target;
      case 'notEmpty':
        return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : false;
      case 'includes':
        if (typeof value === 'string') return value.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(value)) return value.some((item) => item.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
