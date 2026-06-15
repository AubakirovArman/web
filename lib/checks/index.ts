import { Application, Finding, Rule } from '@/lib/types';
import { evaluateMissingDocuments } from '@/lib/rules/engine';
import { runChecks } from '@/lib/checks/engine';

export function runPreCheck(app: Application, rules?: Rule[]): Finding[] {
  const missing = evaluateMissingDocuments(app, rules);
  const mismatches = runChecks(app);
  const byId = new Map<string, Finding>();
  for (const f of [...missing, ...mismatches]) {
    byId.set(f.id, f);
  }
  return Array.from(byId.values());
}
