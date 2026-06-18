import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { readApplications, upsertApplication } from '@/lib/applications/server-store';
import { writeApplicationManifest, writeExtractedFileArtifact } from '@/lib/applications/processing-artifacts';
import { extractDocumentFromBuffer } from '@/lib/ai/extract';
import { readRuntimeUpload } from '@/lib/files/runtime-upload-store';
import type { FileProcessingStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILE_PROCESSING_STATUSES: FileProcessingStatus[] = [
  'queued',
  'extracting',
  'ocr-pending',
  'success',
  'partial',
  'failed',
  'skipped',
];
const FILE_EXTRACTION_TIMEOUT_MS = Number(process.env.NDDA_FILE_EXTRACTION_TIMEOUT_MS || 120000);

function logExtract(event: string, payload: Record<string, unknown>) {
  console.log(`[extract:${event}] ${JSON.stringify(payload)}`);
}

function normalizeProcessingStatus(value: string | undefined): FileProcessingStatus | undefined {
  return FILE_PROCESSING_STATUSES.includes(value as FileProcessingStatus) ? (value as FileProcessingStatus) : undefined;
}

function buildProcessingPatch(extracted: Record<string, string>) {
  const status: FileProcessingStatus =
    normalizeProcessingStatus(extracted.extractionStatus) || (Object.keys(extracted).length > 0 ? 'success' : 'partial');
  const errors = extracted.extractionErrors
    ? extracted.extractionErrors.split(';').map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    status,
    errors,
    provider: extracted.extractionProvider || 'local-parser',
    promptVersion: extracted.extractionPromptVersion || 'unknown',
    textLayer: extracted.textLayer === 'да',
    ocrQuality: status === 'success' ? 0.92 : status === 'partial' || status === 'skipped' ? 0.55 : 0,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function writeArtifactSafely(label: string, write: Promise<unknown>) {
  try {
    await write;
  } catch (error) {
    console.warn(`[extract:artifact-failed] ${label}`, error instanceof Error ? error.message : error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'failed' ? 'failed' : 'all';
    const applications = await readApplications();
    const app = applications.find((item) => item.id === id);
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const stats: Record<string, number> = {};
    const startedAt = new Date().toISOString();
    const userId = req.headers.get('x-user-id') || 'system';

    const shouldExtract = (file: typeof app.files[number]) =>
      mode === 'all' || file.processing?.extractionStatus !== 'success';
    const targetFiles = app.files.filter(shouldExtract);
    logExtract('batch-start', { appId: id, mode, totalFiles: app.files.length, targetFiles: targetFiles.length });
    await writeArtifactSafely('application-manifest', writeApplicationManifest(id, app.files));

    let nextApp = {
      ...app,
      status: 'checking' as const,
      files: app.files.map((file) =>
        shouldExtract(file)
          ? {
              ...file,
              processing: {
                ...(file.processing || {}),
                extractionStatus: 'queued' as const,
                ocrStatus: 'queued' as const,
                startedAt,
                errors: [],
              },
            }
          : file
      ),
    };
    await upsertApplication(nextApp, userId);

    for (const targetFile of targetFiles) {
      const currentFile = nextApp.files.find((file) => file.id === targetFile.id) || targetFile;
      let extractedFile: typeof currentFile;
      const fileStartedAt = Date.now();
      logExtract('file-start', {
        appId: id,
        fileId: currentFile.id,
        name: currentFile.name,
        documentTypeId: currentFile.documentTypeId,
        dossierSectionCode: currentFile.dossierSectionCode,
        contentType: currentFile.contentType,
        size: currentFile.size,
      });

      nextApp = {
        ...nextApp,
        files: nextApp.files.map((file) =>
          file.id === currentFile.id
            ? {
                ...file,
                processing: {
                  ...(file.processing || {}),
                  extractionStatus: 'extracting' as const,
                  ocrStatus: 'extracting' as const,
                  startedAt: file.processing?.startedAt || startedAt,
                  errors: [],
                },
              }
            : file
        ),
      };
      await upsertApplication(nextApp, userId);

      try {
        const { metadata, filePath } = await readRuntimeUpload(currentFile.id);
        logExtract('file-read-start', {
          appId: id,
          fileId: currentFile.id,
          name: metadata.fileName,
          filePath,
          contentType: metadata.contentType,
          size: metadata.size,
        });
        const buffer = await fs.readFile(filePath);
        logExtract('file-read-done', { appId: id, fileId: currentFile.id, bytes: buffer.length });
        const extracted = await withTimeout(
          extractDocumentFromBuffer(buffer, metadata.fileName, currentFile.documentTypeId),
          FILE_EXTRACTION_TIMEOUT_MS,
          `Extraction ${metadata.fileName}`
        );
        const processing = buildProcessingPatch(extracted);
        stats[processing.status] = (stats[processing.status] || 0) + 1;
        logExtract('file-done', {
          appId: id,
          fileId: currentFile.id,
          name: metadata.fileName,
          status: processing.status,
          provider: processing.provider,
          textLength: extracted.textLength || String(extracted.textContent?.length || 0),
          durationMs: Date.now() - fileStartedAt,
        });

        extractedFile = {
          ...currentFile,
          name: currentFile.name || metadata.fileName,
          size: metadata.size,
          contentType: metadata.contentType,
          extracted,
          textLayer: processing.textLayer,
          ocrQuality: processing.ocrQuality,
          processing: {
            ...(currentFile.processing || {}),
            extractionStatus: processing.status,
            ocrStatus: processing.status,
            provider: processing.provider,
            promptVersion: processing.promptVersion,
            startedAt: currentFile.processing?.startedAt || startedAt,
            finishedAt: new Date().toISOString(),
            errors: processing.errors,
            textLayer: processing.textLayer,
            ocrQuality: processing.ocrQuality,
          },
        };
      } catch (error: any) {
        stats.failed = (stats.failed || 0) + 1;
        logExtract('file-failed', {
          appId: id,
          fileId: currentFile.id,
          name: currentFile.name,
          error: error?.message || 'Extraction failed',
          durationMs: Date.now() - fileStartedAt,
        });
        extractedFile = {
          ...currentFile,
          processing: {
            ...(currentFile.processing || {}),
            extractionStatus: 'failed' as const,
            ocrStatus: 'failed' as const,
            provider: currentFile.processing?.provider || 'document-parser-service',
            startedAt: currentFile.processing?.startedAt || startedAt,
            finishedAt: new Date().toISOString(),
            errors: [error?.message || 'Extraction failed'],
            textLayer: false,
            ocrQuality: 0,
          },
        };
      }

      nextApp = {
        ...nextApp,
        files: nextApp.files.map((file) => file.id === extractedFile.id ? extractedFile : file),
      };
      await upsertApplication(nextApp, userId);
      await writeArtifactSafely(`file:${extractedFile.id}`, writeExtractedFileArtifact(id, extractedFile));
    }

    const nextApplications = await upsertApplication(nextApp, userId);
    logExtract('batch-done', { appId: id, mode, processed: targetFiles.length, stats });

    return NextResponse.json({
      application: nextApplications.find((item) => item.id === id) || nextApp,
      stats,
      mode,
      processed: targetFiles.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to extract application files' }, { status: 500 });
  }
}
