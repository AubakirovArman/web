import { Application, DocumentType, Finding, Rule } from '@/lib/types';
import { evaluateMissingDocuments } from '@/lib/rules/engine';
import { runChecks } from '@/lib/checks/engine';
import { enrichFindings } from '@/lib/checks/registry';

const submissionBlockingSeverities: Finding['severity'][] = ['critical', 'serious'];

export type ValidationMode = 'draft' | 'section' | 'submit';
export type ValidationScope = 'all' | 'params' | 'documents';

export interface ValidationOptions {
  mode: ValidationMode;
  scope: ValidationScope;
  documentTypes?: DocumentType[];
}

export interface ValidationResult {
  findings: Finding[];
  blockingFindings: Finding[];
  success: boolean;
}

export function getBlockingFindings(findings: Finding[]): Finding[] {
  return findings.filter((f) => submissionBlockingSeverities.includes(f.severity));
}

export function hasBlockingFindings(findings: Finding[]): boolean {
  return getBlockingFindings(findings).length > 0;
}

export function runValidation(
  app: Application,
  rules?: Rule[],
  options: Partial<ValidationOptions> = {}
): ValidationResult {
  const mode: ValidationMode = options.mode ?? 'submit';
  const scope: ValidationScope = options.scope ?? 'all';

  if (mode === 'draft') {
    return { findings: [], blockingFindings: [], success: true };
  }

  if (mode === 'section') {
    if (scope === 'params') {
      const findings = runChecks(app, rules, { scope: 'params', documentTypes: options.documentTypes });
      const blockingFindings = getBlockingFindings(findings);
      return { findings, blockingFindings, success: blockingFindings.length === 0 };
    }

    const findings = runPreCheck(app, rules, { scope: 'documents', documentTypes: options.documentTypes });
    const blockingFindings = getBlockingFindings(findings);
    return { findings, blockingFindings, success: blockingFindings.length === 0 };
  }

  const findings = runPreCheck(app, rules, { scope: 'all', documentTypes: options.documentTypes });
  const blockingFindings = getBlockingFindings(findings);
  return { findings, blockingFindings, success: blockingFindings.length === 0 };
}

export function runSubmissionValidation(app: Application, rules?: Rule[]): ValidationResult {
  return runValidation(app, rules, { mode: 'submit', scope: 'all' });
}

export function runSectionValidation(
  app: Application,
  rules?: Rule[],
  scope: ValidationScope = 'all'
): ValidationResult {
  return runValidation(app, rules, { mode: 'section', scope });
}

export function runPreCheck(
  app: Application,
  rules?: Rule[],
  options: { scope: ValidationScope; documentTypes?: DocumentType[] } = { scope: 'all' }
): Finding[] {
  const scope = options.scope || 'all';
  const findings: Finding[] = [];

  if (scope === 'all' || scope === 'documents') {
    const missing = evaluateMissingDocuments(app, rules, options.documentTypes);
    for (const finding of missing) {
      findings.push(finding);
    }
  }

  const checksScope = scope === 'params' ? 'params' : scope;
  const mismatches = runChecks(app, rules, { scope: checksScope, documentTypes: options.documentTypes });
  for (const finding of mismatches) {
    findings.push(finding);
  }

  const byId = new Map<string, Finding>();
  for (const finding of findings) {
    byId.set(finding.id, finding);
  }

  return enrichFindings(Array.from(byId.values()));
}
