import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readApplicationById, upsertApplication } from '@/lib/applications/server-store';
import { copyRuntimeUpload, runtimeFileUrl } from '@/lib/files/runtime-upload-store';
import type { Application, Finding, UploadedFile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_INTERNAL_ORIGIN = process.env.NDDA_INTERNAL_APP_ORIGIN || 'http://127.0.0.1:8040';

function resetFileForFreshPipeline(
  file: UploadedFile,
  nextFileId: string,
  metadata: { fileName: string; contentType: string; size: number },
): UploadedFile {
  const {
    extracted: _extracted,
    npaRequirementResults: _npaRequirementResults,
    processing: _processing,
    textLayer: _textLayer,
    ocrQuality: _ocrQuality,
    pageCount: _pageCount,
    ...rest
  } = file;

  return {
    ...rest,
    id: nextFileId,
    name: file.name || metadata.fileName,
    originalName: file.originalName || metadata.fileName,
    size: metadata.size,
    contentType: file.contentType || metadata.contentType,
    url: runtimeFileUrl(nextFileId),
    uploadedAt: new Date().toISOString(),
    version: (file.version || 0) + 1,
    processing: {
      extractionStatus: 'queued',
      ocrStatus: 'queued',
      startedAt: new Date().toISOString(),
      errors: [],
    },
  };
}

async function postJson(origin: string, path: string, body: unknown, userId: string) {
  const response = await fetch(`${origin.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `${path} failed with HTTP ${response.status}`);
  }
  return payload;
}

function buildPipelineFailureFinding(error: unknown): Finding {
  return {
    id: `test-submit-pipeline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    severity: 'warning',
    category: 'Тестовый прогон',
    title: 'Полный тестовый прогон не завершился автоматически',
    description: 'Неизвестная ошибка при запуске pipeline.',
    documents: [],
    recommendation: 'Откройте заявку у эксперта и запустите извлечение/проверку вручную.',
    checkerId: 'test_submission_pipeline',
    status: 'open',
  };
}

async function runFreshPipeline(applicationId: string, userId: string, origin = DEFAULT_INTERNAL_ORIGIN) {
  try {
    await postJson(origin, `/api/applications/${encodeURIComponent(applicationId)}/extract`, { mode: 'all' }, userId);
    await postJson(origin, `/api/applications/${encodeURIComponent(applicationId)}/check`, {}, userId);

    const dryRun = await postJson(
      origin,
      `/api/applications/${encodeURIComponent(applicationId)}/npa-gemma-check`,
      {
        dryRun: true,
        skipCompleted: true,
        maxFiles: 200,
        maxTotalRequirements: 500,
      },
      userId,
    );

    const totalRequirements = Number(dryRun?.totalRequirements || 0);
    let processed = 0;
    for (let iteration = 0; iteration < 100 && processed < totalRequirements; iteration += 1) {
      const chunk = await postJson(
        origin,
        `/api/applications/${encodeURIComponent(applicationId)}/npa-gemma-check`,
        {
          skipCompleted: true,
          maxFiles: 6,
          maxRequirementsPerFile: 4,
          maxTotalRequirements: 12,
        },
        userId,
      );
      const chunkRequirements = Number(chunk?.stats?.requirements || 0);
      if (chunkRequirements <= 0) break;
      processed += chunkRequirements;
    }

    const completed = await readApplicationById(applicationId);
    if (completed && completed.status !== 'expert-review') {
      await upsertApplication({ ...completed, status: 'submitted' }, userId);
    }
  } catch (error) {
    console.error('[test-submit:pipeline-failed]', applicationId, error);
    const failed = await readApplicationById(applicationId).catch(() => null);
    if (failed) {
      await upsertApplication(
        {
          ...failed,
          status: 'checked',
          findings: [...(failed.findings || []), buildPipelineFailureFinding(error)],
        },
        userId,
      );
    }
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const source = await readApplicationById(id);
    if (!source) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const userId = req.headers.get('x-user-id') || 'system';
    const now = new Date().toISOString();
    const nextId = `test-${randomUUID()}`;
    const nextFiles: UploadedFile[] = [];

    for (const file of source.files || []) {
      const nextFileId = `${nextId}-${randomUUID()}`;
      const metadata = await copyRuntimeUpload(file.id, nextFileId);
      nextFiles.push(resetFileForFreshPipeline(file, nextFileId, metadata));
    }

    const nextApplication: Application = {
      ...source,
      id: nextId,
      createdAt: now,
      status: 'checking',
      files: nextFiles,
      checklist: [],
      findings: [],
    };

    const applications = await upsertApplication(nextApplication, userId);
    const saved = applications.find((item) => item.id === nextId) || nextApplication;

    void runFreshPipeline(nextId, userId).catch((error) => {
      console.error('[test-submit:pipeline-unhandled]', nextId, error);
    });

    return NextResponse.json({
      application: saved,
      sourceApplicationId: source.id,
      pipelineStarted: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create test submission' }, { status: 500 });
  }
}
