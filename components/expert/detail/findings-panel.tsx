'use client';

import { Application, Finding } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { FindingCard } from '@/components/expert/detail/finding-card';
import { NpaFindingFilter } from '@/components/expert/detail/review-types';
import { npaFilterLabel } from '@/components/expert/detail/review-logic';

export function FindingsPanel({
  app,
  npaFindingFilter,
  npaGemmaFindings,
  filteredNpaGemmaFindings,
  onFilterChange,
  onFindingPatch,
}: {
  app: Application;
  npaFindingFilter: NpaFindingFilter;
  npaGemmaFindings: Finding[];
  filteredNpaGemmaFindings: Finding[];
  onFilterChange: (filter: NpaFindingFilter) => void;
  onFindingPatch: (finding: Finding, patch: Partial<Finding>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Замечания эксперту</CardTitle>
            <p className="text-sm text-muted-foreground">Фильтр применяется ко всем замечаниям, включая блок НПА.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'critical', 'serious', 'warning', 'unknown'] as NpaFindingFilter[]).map((filter) => {
              const count = filter === 'all' ? app.findings.length : app.findings.filter((finding) => finding.severity === filter).length;
              return (
                <Button key={filter} size="sm" variant={npaFindingFilter === filter ? 'default' : 'outline'} onClick={() => onFilterChange(filter)}>
                  {npaFilterLabel(filter)} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {filteredNpaGemmaFindings.length > 0 && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">Замечания НПА</div>
              <div className="text-sm text-muted-foreground">показано {filteredNpaGemmaFindings.length} из {npaGemmaFindings.length}</div>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {filteredNpaGemmaFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} onPatch={(patch) => onFindingPatch(finding, patch)} compact />
              ))}
            </div>
          </div>
        )}

        {app.findings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-100">
            <CheckCircle2 className="h-5 w-5" />
            Замечаний нет. Эталонная заявка проходит автоматические критерии.
          </div>
        ) : (() => {
          // Основной список: прочие замечания (НПА уже показаны в блоке выше),
          // фильтруются тем же фильтром по серьёзности.
          const otherFindings = app.findings.filter((finding) => finding.checkerId !== 'npa_imported_requirement_check');
          const filteredOther = npaFindingFilter === 'all'
            ? otherFindings
            : otherFindings.filter((finding) => finding.severity === npaFindingFilter);
          if (filteredOther.length === 0 && filteredNpaGemmaFindings.length === 0) {
            return <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">По выбранному фильтру замечаний нет.</p>;
          }
          return filteredOther.map((finding) => (
            <FindingCard key={finding.id} finding={finding} onPatch={(patch) => onFindingPatch(finding, patch)} />
          ));
        })()}
      </CardContent>
    </Card>
  );
}
