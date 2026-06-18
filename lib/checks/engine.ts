import type { Application, DocumentType, Finding, Rule } from '@/lib/types';
import { runChecksWithCatalog } from '@/lib/checks/engine-runner';
import { withDocumentTypesCatalog, type CheckScope } from '@/lib/checks/engine-utils';

export function runChecks(
  app: Application,
  rules: Rule[] = [],
  options: { scope?: CheckScope; documentTypes?: DocumentType[] } = {}
): Finding[] {
  return withDocumentTypesCatalog(options.documentTypes, () => runChecksWithCatalog(app, rules, options.scope || 'all'));
}
