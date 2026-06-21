import { NextRequest, NextResponse } from 'next/server';
import { readApplications, upsertApplication } from '@/lib/applications/server-store';
import { readAdminRuntimeConfig } from '@/lib/admin/server-store';
import { runPreCheck } from '@/lib/checks';
import { buildNpaGemmaFindingsFromSavedResults } from '@/lib/checks/npa-gemma-results';
import { resolveLsRegistrationRequiredDocuments } from '@/lib/document-requirements/ls-registration-resolver';
import { evaluateMissingRequiredDocuments } from '@/lib/rules/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const applications = await readApplications();
    const app = applications.find((item) => item.id === id);
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const adminConfig = await readAdminRuntimeConfig();
    const isLsRegistration = app.values['param-object-type'] === 'LS' && app.values['param-procedure'] === 'registration';
    let documentTypesForChecks = isLsRegistration ? [] : adminConfig.documentTypes;
    let dbRequiredDocuments = null as Awaited<ReturnType<typeof resolveLsRegistrationRequiredDocuments>> | null;
    if (isLsRegistration) {
      dbRequiredDocuments = await resolveLsRegistrationRequiredDocuments(app.values);
      if (dbRequiredDocuments.databaseRulesCount === 0) {
        return NextResponse.json(
          { error: 'Postgres document_requirement_rules has no LS/registration rules. Local fallback is disabled.' },
          { status: 500 },
        );
      }
      documentTypesForChecks = dbRequiredDocuments.documentTypes;
    }

    let findings = runPreCheck(app, adminConfig.rules, {
      scope: 'all',
      documentTypes: documentTypesForChecks,
    });
    if (isLsRegistration) {
      if (dbRequiredDocuments?.databaseRulesCount) {
        const missingFromDbRules = evaluateMissingRequiredDocuments(
          app,
          dbRequiredDocuments.requiredDocuments,
          documentTypesForChecks,
          adminConfig.rules,
        );
        findings = [
          ...findings.filter((finding) => finding.checkerId !== 'required_document_presence_check'),
          ...missingFromDbRules,
        ];
      }
    }
    const savedNpaGemmaFindings = buildNpaGemmaFindingsFromSavedResults(app, documentTypesForChecks);
    const mergedFindings = savedNpaGemmaFindings.length
      ? [
          ...findings.filter((finding) => finding.checkerId !== 'npa_imported_requirement_check'),
          ...savedNpaGemmaFindings,
        ]
      : findings;
    const nextStatus = app.status === 'submitted' || app.status === 'expert-review' ? app.status : 'checked';
    const nextApp = {
      ...app,
      status: nextStatus,
      findings: mergedFindings,
    };

    const userId = req.headers.get('x-user-id') || 'system';
    const nextApplications = await upsertApplication(nextApp, userId);
    return NextResponse.json({
      application: nextApplications.find((item) => item.id === id),
      findings: mergedFindings,
      adminConfigUpdatedAt: adminConfig.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to run checks' }, { status: 500 });
  }
}
