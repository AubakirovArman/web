import type { CheckRunContext } from '@/lib/checks/engine-context';
import { runLsBioQualityChecks } from '@/lib/checks/runners/ls/bioquality-checks';
import { runLsConsistencyChecks } from '@/lib/checks/runners/ls/consistency-checks';
import { runLsManufacturingChecks } from '@/lib/checks/runners/ls/manufacturing-checks';
import { runLsReregistrationChecks } from '@/lib/checks/runners/ls/reregistration-checks';
import { runLsVariationChecks } from '@/lib/checks/runners/ls/variation-checks';

export function runLsChecks(context: CheckRunContext) {
  runLsManufacturingChecks(context);
  runLsConsistencyChecks(context);
  runLsBioQualityChecks(context);
  runLsReregistrationChecks(context);
  runLsVariationChecks(context);
}
