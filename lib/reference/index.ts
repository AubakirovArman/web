import referenceIndexJson from '@/data/reference/generated/knowledge-index.json';
import { ReferenceDocument, ReferenceSearchItem } from '@/lib/types';

interface ReferenceIndex {
  generatedAt: string;
  sourceRoot: string;
  documents: ReferenceDocument[];
  searchItems: ReferenceSearchItem[];
}

export const referenceIndex = referenceIndexJson as ReferenceIndex;

export const referenceDocuments = referenceIndex.documents;

export const referenceSearchItems = referenceIndex.searchItems;

export function getReferenceDocumentById(id: string): ReferenceDocument | undefined {
  return referenceDocuments.find((document) => document.id === id);
}

export function getReferenceMarkdownFileName(id: string): string | undefined {
  const document = getReferenceDocumentById(id);
  if (!document) return undefined;
  return `${document.id}.md`;
}

export function getReferenceStats() {
  return {
    generatedAt: referenceIndex.generatedAt,
    sourceRoot: referenceIndex.sourceRoot,
    documentsCount: referenceDocuments.length,
    searchItemsCount: referenceSearchItems.length,
  };
}
