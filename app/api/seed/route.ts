import { NextResponse } from 'next/server';
import path from 'path';
import { demoFiles } from '@/lib/data/demoFiles';
import { defaultApplicationValues } from '@/lib/data/seed';
import { extractDocument } from '@/lib/ai/extract';
import { runPreCheck } from '@/lib/checks';
import { Application } from '@/lib/types';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST() {
  try {
    const baseDir = path.join(process.cwd(), 'public', 'test-docs');

    const files: Application['files'] = await Promise.all(
      demoFiles.map(async (f) => {
        const extracted = await extractDocument(path.join(baseDir, f.name), f.documentTypeId);
        return {
          ...f,
          id: uid(),
          extracted: { ...f.extracted, ...extracted },
        };
      })
    );

    const appFile = files.find((f) => f.documentTypeId === 'doc-application');
    const appExtracted = appFile?.extracted || {};

    const values: Application['values'] = {
      ...defaultApplicationValues,
      'param-trade-name': appExtracted.tradeName || (defaultApplicationValues['param-trade-name'] as string),
      'param-inn': appExtracted.inn || (defaultApplicationValues['param-inn'] as string),
      'param-dosage': appExtracted.dosage || (defaultApplicationValues['param-dosage'] as string),
      'param-dosage-form': appExtracted.dosageForm || (defaultApplicationValues['param-dosage-form'] as string),
      'param-manufacturer': appExtracted.manufacturer || (defaultApplicationValues['param-manufacturer'] as string),
      'param-manufacturer-address': appExtracted.manufacturerAddress || (defaultApplicationValues['param-manufacturer-address'] as string),
      'param-applicant': appExtracted.applicant || (defaultApplicationValues['param-applicant'] as string),
      'param-holder': appExtracted.holder || (defaultApplicationValues['param-holder'] as string),
    };

    const app: Application = {
      id: uid(),
      createdAt: new Date().toISOString(),
      status: 'checked',
      values,
      files,
      checklist: [],
      findings: [],
    };

    app.findings = runPreCheck(app);

    return NextResponse.json({ app });
  } catch (err: any) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: err.message || 'Seed failed' }, { status: 500 });
  }
}
