import { NextRequest, NextResponse } from 'next/server';
import { createDemoFiles, demoScenarioLabels } from '@/lib/data/demoFiles';
import type { DemoScenario } from '@/lib/data/demoFiles';
import { defaultApplicationValues } from '@/lib/data/seed';
import { runPreCheck } from '@/lib/checks';
import { Application } from '@/lib/types';

const allowedScenarios = new Set<DemoScenario>(['ideal', 'missing-gmp', 'expired-cpp', 'field-mismatch', 'bad-docx-format']);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeScenario(value: unknown): DemoScenario {
  return typeof value === 'string' && allowedScenarios.has(value as DemoScenario) ? (value as DemoScenario) : 'ideal';
}

export async function POST(request: NextRequest) {
  try {
    let bodyScenario: unknown;
    try {
      const body = await request.json();
      bodyScenario = body?.scenario;
    } catch {
      bodyScenario = undefined;
    }

    const scenario = normalizeScenario(bodyScenario || request.nextUrl.searchParams.get('scenario'));
    const files: Application['files'] = createDemoFiles(scenario).map((file) => ({
      ...file,
      id: uid(),
      uploadedAt: file.uploadedAt || new Date().toISOString(),
    }));

    const appFile = files.find((file) => file.documentTypeId === 'doc-application');
    const appExtracted = appFile?.extracted || {};

    const values: Application['values'] = {
      ...defaultApplicationValues,
      'param-trade-name': appExtracted.tradeName || defaultApplicationValues['param-trade-name'],
      'param-trade-name-ru': appExtracted.tradeName || defaultApplicationValues['param-trade-name-ru'],
      'param-trade-name-kz': appExtracted.tradeName || defaultApplicationValues['param-trade-name-kz'],
      'param-inn': appExtracted.inn || defaultApplicationValues['param-inn'],
      'param-inn-ru': appExtracted.inn || defaultApplicationValues['param-inn-ru'],
      'param-inn-kz': appExtracted.inn || defaultApplicationValues['param-inn-kz'],
      'param-dosage': appExtracted.dosage || defaultApplicationValues['param-dosage'],
      'param-dosage-form': defaultApplicationValues['param-dosage-form'],
      'param-manufacturer': appExtracted.manufacturer || defaultApplicationValues['param-manufacturer'],
      'param-manufacturer-address': appExtracted.manufacturerAddress || defaultApplicationValues['param-manufacturer-address'],
      'param-applicant': appExtracted.applicant || defaultApplicationValues['param-applicant'],
      'param-holder': appExtracted.holder || defaultApplicationValues['param-holder'],
    };

    const app: Application = {
      id: uid(),
      createdAt: new Date().toISOString(),
      status: 'submitted',
      values,
      files,
      checklist: [],
      findings: [],
    };

    app.findings = runPreCheck(app);

    return NextResponse.json({ app, scenario, scenarioLabel: demoScenarioLabels[scenario] });
  } catch (err: any) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: err.message || 'Seed failed' }, { status: 500 });
  }
}
