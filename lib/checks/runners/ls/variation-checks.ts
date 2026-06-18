import type { CheckRunContext } from '@/lib/checks/engine-context';
import { runLsVariationDescriptionChecks } from '@/lib/checks/runners/ls/variation/description-checks';
import { runLsVariationSpcProjectChecks } from '@/lib/checks/runners/ls/variation/spc-project-checks';
import { runLsVariationSupportingChecks } from '@/lib/checks/runners/ls/variation/supporting-checks';

export function runLsVariationChecks(context: CheckRunContext) {
  if (context.procedure !== 'variation') return;
  runLsVariationDescriptionChecks(context);
  runLsVariationSpcProjectChecks(context);
  runLsVariationSupportingChecks(context);
}
