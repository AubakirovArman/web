'use client';

import { useEffect, useState } from 'react';
import type { DocumentType } from '@/lib/types';

/**
 * Загружает полный список типов документов (id + имя) для маппинга
 * targetDocumentTypeId → название в таблицах НПА/требований.
 * Использует lite-конфиг (без тяжёлых датасетов).
 */
export function useAdminDocumentTypes(): DocumentType[] {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/config?lite=1', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.documentTypes)) setDocumentTypes(data.documentTypes);
      })
      .catch(() => {
        /* мягкая деградация: таблица покажет id вместо имени */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return documentTypes;
}
