import { resolveLsRegistrationRequiredDocuments } from '@/lib/document-requirements/ls-registration-resolver';
import type { DocumentType, DocumentTypeRequirement } from '@/lib/types';
import type { DocumentTypesLoadInput, DocumentTypesLoadResult } from './types';

export async function loadDocumentTypesForApplication(input: DocumentTypesLoadInput): Promise<DocumentTypesLoadResult> {
  const { app, adminDocumentTypes } = input;
  const isLsRegistration = app.values['param-object-type'] === 'LS' && app.values['param-procedure'] === 'registration';
  if (!isLsRegistration) return { source: 'admin', documentTypes: adminDocumentTypes };

  const resolved = await resolveLsRegistrationRequiredDocuments(app.values);
  if (resolved.databaseRulesCount === 0) {
    throw new Error('Postgres document_requirement_rules has no LS/registration rules. Local fallback is disabled.');
  }

  return {
    source: 'postgres',
    documentTypes: mergeDocumentTypes(adminDocumentTypes, resolved.documentTypes),
    databaseRulesCount: resolved.databaseRulesCount,
  };
}

function mergeDocumentTypes(base: DocumentType[], extra: DocumentType[]): DocumentType[] {
  const byId = new Map<string, DocumentType>();
  for (const item of base) byId.set(item.id, normalizeDocumentType(item));
  for (const item of extra) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? mergeDocumentType(existing, item) : normalizeDocumentType(item));
  }
  return Array.from(byId.values());
}

function normalizeDocumentType(documentType: DocumentType): DocumentType {
  return {
    ...documentType,
    importedRequirements: dedupeRequirements(documentType.importedRequirements || []),
  };
}

function mergeDocumentType(base: DocumentType, extra: DocumentType): DocumentType {
  return {
    ...base,
    ...extra,
    name: extra.name || base.name,
    description: extra.description || base.description,
    acceptedFormats: extra.acceptedFormats?.length ? extra.acceptedFormats : base.acceptedFormats,
    checkIds: Array.from(new Set([...(base.checkIds || []), ...(extra.checkIds || [])])),
    expectedExtractedFields: Array.from(new Set([...(base.expectedExtractedFields || []), ...(extra.expectedExtractedFields || [])])),
    importedRequirements: (extra.importedRequirements || []).length
      ? dedupeRequirements(extra.importedRequirements || [])
      : dedupeRequirements(base.importedRequirements || []),
    npaReferences: Array.from(new Set([...(base.npaReferences || []), ...(extra.npaReferences || [])])),
    linkedApplicationParams: Array.from(new Set([...(base.linkedApplicationParams || []), ...(extra.linkedApplicationParams || [])])),
    validationChecksText: extra.validationChecksText || base.validationChecksText,
  };
}

function dedupeRequirements(requirements: DocumentTypeRequirement[]): DocumentTypeRequirement[] {
  const byKey = new Map<string, DocumentTypeRequirement>();
  for (const requirement of requirements) {
    const key = [
      normalizeRequirementText(requirement.sourceDocumentCode),
      normalizeRequirementText(requirement.checkType),
      normalizeRequirementText(requirement.requirementText),
    ].join('|') || requirement.id;
    if (!byKey.has(key)) byKey.set(key, requirement);
  }
  return Array.from(byKey.values());
}

function normalizeRequirementText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/р/g, 'p')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();
}
