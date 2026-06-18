import type { Application, Finding, Rule } from '@/lib/types';
import { getRequiredParameterIds, productTypeLabels } from '@/lib/data/seed';
import { applyScopeAndRuleFilters, type CheckScope } from '@/lib/checks/engine-utils';
import type { CheckRunContext } from '@/lib/checks/engine-context';
import { runApplicationAndFileChecks } from '@/lib/checks/runners/engine-general-runner';
import { runLsChecks } from '@/lib/checks/runners/engine-ls-runner';
import { runMiChecks } from '@/lib/checks/runners/engine-mi-runner';

export function runChecksWithCatalog(
  app: Application,
  rules: Rule[] = [],
  scope: CheckScope = 'all',
): Finding[] {
  const findings: Finding[] = [];
  const values = app.values;
  const objectType = values['param-object-type'] === 'MI' ? 'MI' : 'LS';
  const procedure = values['param-procedure'] === 're-registration' || values['param-procedure'] === 'variation' ? values['param-procedure'] : 'registration';
  const isLS = objectType === 'LS';
  const isMI = objectType === 'MI';
  const productType = values['param-product-type'] as string;
  const productLabel = productTypeLabels[productType as keyof typeof productTypeLabels] || productType;
  const requiredFieldIds = getRequiredParameterIds(objectType, procedure);
  const context: CheckRunContext = {
    app,
    rules,
    scope,
    findings,
    values,
    objectType,
    procedure,
    isLS,
    isMI,
    productType,
    productLabel,
    requiredFieldIds,
  };

  runApplicationAndFileChecks(context);
  if (isLS) runLsChecks(context);
  if (isMI) runMiChecks(context);

  return applyScopeAndRuleFilters(findings, app, rules, scope);
}
