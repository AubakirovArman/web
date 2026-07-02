'use client';

import { useEffect, useReducer } from 'react';
import { registerConditionAttributes } from '@/lib/admin/condition-attributes';
import type { Parameter } from '@/lib/types';

/**
 * Одноразовая (на вкладку) подгрузка кастомных полей и их регистрация как
 * атрибутов конструктора условий. Кэшируется, чтобы множество ConditionBuilder
 * не дёргали API повторно.
 */
let loaded = false;
let inflight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

export function ensureCustomAttributes(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!inflight) {
    inflight = fetch('/api/custom-fields', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customFields: [] }))
      .then((data) => {
        if (Array.isArray(data?.customFields)) registerConditionAttributes(data.customFields as Parameter[]);
        loaded = true;
        subscribers.forEach((fn) => fn());
      })
      .catch(() => {
        inflight = null; // разрешить повтор при следующей попытке
      });
  }
  return inflight;
}

/** true, когда кастомные атрибуты загружены и зарегистрированы. */
export function useCustomAttributesReady(): boolean {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (loaded) return;
    const fn = () => force();
    subscribers.add(fn);
    void ensureCustomAttributes();
    return () => {
      subscribers.delete(fn);
    };
  }, []);
  return loaded;
}
