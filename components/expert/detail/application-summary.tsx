'use client';

import { Application } from '@/lib/types';
import { productTypeLabels } from '@/lib/data/seed';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { countryLabel, formatAtc, formatComposition, formatDosage, formatExportNames, formatForeignRegistrations, formatLanguageTriple, formatLegalProtection, formatManufacturers, formatOrphanStatus, formatPackaging, formatProductionSites, formatQcLab, formatRoutes, formatSpecialFlags, formatUsePeriods, formatVariationChanges, parseJsonValue, stringValue, unitLabel, yesNo } from '@/components/expert/detail/application-formatters';
import { labelFor } from '@/components/expert/detail/condition-formatters';

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="break-all text-sm">{value || '—'}</p>
    </div>
  );
}

export function MetricCard({ label, value, tone }: { label: string; value: number | string; tone: 'neutral' | 'passed' | 'failed' | 'warning' | 'serious' }) {
  const styles = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-100',
    passed: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-100',
    failed: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-950/20 dark:text-yellow-100',
    serious: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function Field({ label, value }: { label: string; value?: string | string[] }) {
  const display = Array.isArray(value) ? value.join(', ') : value || '—';
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{display}</p>
    </div>
  );
}

export function LsApplicationSummary({ values }: { values: Application['values'] }) {
  const exportRows = parseJsonValue<Array<{ country?: string; nameKz?: string; nameRu?: string; nameEn?: string }>>(values['param-export-trade-names'], []);
  const compositionRows = parseJsonValue<Array<{ substanceType?: string; name?: string; quantity?: string; unit?: string; normativeDocument?: string; manufacturer?: string }>>(values['param-composition-table'], []);
  const variationRows = parseJsonValue<Array<{ changeType?: string; before?: string; after?: string }>>(values['param-variation-changes-table'], []);

  return (
    <div className="space-y-4">
      <SummaryBlock
        title="I-II. Базовые сведения о ЛС"
        items={[
          ['Заявка на платеж', stringValue(values['param-payment-request'])],
          ['Сведения о РУ', stringValue(values['param-registration-certificate-info'])],
          ['Торговое наименование', formatLanguageTriple(values, 'param-trade-name')],
          ['МНН', formatLanguageTriple(values, 'param-inn') || stringValue(values['param-inn'])],
          ['Комментарий к МНН', stringValue(values['param-inn-comments'])],
          ['Лекарственная форма', labelFor('param-dosage-form', values['param-dosage-form'])],
          ['Дозировка', formatDosage(values)],
          ['АТХ', formatAtc(values)],
        ]}
      />

      <StructuredRows
        title="Торговые наименования на экспорт"
        emptyText="Экспортные наименования не указаны"
        columns={['Страна', 'Гос. язык', 'Русский', 'Английский']}
        rows={exportRows.map((row) => [
          countryLabel(row.country),
          row.nameKz || '—',
          row.nameRu || '—',
          row.nameEn || '—',
        ])}
      />

      <SummaryBlock
        title="III. Тип ЛС и особые статусы"
        items={[
          ['Тип препарата', productTypeLabels[values['param-product-type'] as keyof typeof productTypeLabels] || stringValue(values['param-product-type'])],
          ['Флаги типа ЛС', formatSpecialFlags(values)],
          ['Орфанный статус', formatOrphanStatus(values)],
          ['Трансфер', stringValue(values['param-transfer-enabled']) === 'yes' ? stringValue(values['param-transfer-site']) || 'Да' : 'Нет'],
          ['АФС без GMP / растительное сырье', yesNo(values['param-api-special-status'])],
          ['Преквалификация ВОЗ', yesNo(values['param-who-prequalification'])],
        ]}
      />

      <SummaryBlock
        title="IV. Применение и упаковка"
        items={[
          ['Форма отпуска', labelFor('param-dispensing', values['param-dispensing'])],
          ['Комментарий к форме отпуска', stringValue(values['param-dispensing-comment'])],
          ['Способы введения', formatRoutes(values['param-administration-routes'] || values['param-administration-route'])],
          ['Устройства введения', stringValue(values['param-administration-device'])],
          ['Упаковка', formatPackaging(values['param-packaging'])],
        ]}
      />

      <StructuredRows
        title="Полный качественный и количественный состав"
        emptyText={stringValue(values['param-composition']) || 'Состав не указан'}
        columns={['Тип', 'Наименование', 'Количество', 'НД', 'Производитель']}
        rows={compositionRows.map((row) => [
          row.substanceType || '—',
          row.name || '—',
          [row.quantity, row.unit ? unitLabel(row.unit) : ''].filter(Boolean).join(' ') || '—',
          row.normativeDocument || '—',
          row.manufacturer || '—',
        ])}
      />

      <SummaryBlock
        title="VI. Стабильность, регистрация и оплата"
        items={[
          ['Срок хранения', stringValue(values['param-shelf-life'])],
          ['Периоды применения', formatUsePeriods(values)],
          ['Условия хранения', stringValue(values['param-storage-conditions'])],
          ['Условия транспортирования', stringValue(values['param-transport-conditions'])],
          ['Регистрации в других странах', formatForeignRegistrations(values['param-foreign-registrations'])],
          ['Правовая охрана', formatLegalProtection(values['param-patent-trademark'])],
          ['Производители', formatManufacturers(values['param-manufacturers'])],
          ['Производство ЛП', formatProductionSites(values['param-production-sites'])],
          ['Лаборатория контроля качества', formatQcLab(values)],
          ['Договор на экспертизу', [
            stringValue(values['param-contract-number']) ? `№ ${stringValue(values['param-contract-number'])}` : '',
            stringValue(values['param-contract-date']) ? `Дата договора: ${stringValue(values['param-contract-date'])}` : '',
            stringValue(values['param-contract-term']) ? `Дата договора на экспертизу: ${stringValue(values['param-contract-term'])}` : '',
          ].filter(Boolean).join(' · ')],
          ['Субъект оплаты', stringValue(values['param-payment-subject'])],
        ]}
      />

      {values['param-procedure'] === 'variation' && (
        <StructuredRows
          title="Изменения, вносимые в досье"
          emptyText="Изменения не указаны"
          columns={['Вид', 'Редакция до изменений', 'Предлагаемые изменения']}
          rows={variationRows.map((row) => [
            row.changeType || '—',
            row.before || '—',
            row.after || '—',
          ])}
        />
      )}
    </div>
  );
}

function SummaryBlock({ title, items }: { title: string; items: Array<[string, string | undefined]> }) {
  const visible = items.filter(([, value]) => value && value !== '—');
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="space-y-2">
        {(visible.length ? visible : items.slice(0, 1)).map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="whitespace-pre-wrap break-words text-sm font-medium">{value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StructuredRows({
  title,
  emptyText,
  columns,
  rows,
}: {
  title: string;
  emptyText: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                {columns.map((column) => (
                  <th key={column} className="border-b px-2 py-1 font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-b px-2 py-1 align-top">{cell || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
