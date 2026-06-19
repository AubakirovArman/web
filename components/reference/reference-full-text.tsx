import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { findSectionHighlights, renderValue } from './reference-utils';
import type { ReferenceExperimentDocument } from './reference-types';

export function FullText({ document }: { document: ReferenceExperimentDocument }) {
  const highlights = document.intelligence?.highlights || [];
  return (
    <div className="space-y-3">
      {document.sections.map((section) => {
        const related = findSectionHighlights(section, highlights);
        return (
          <Card key={section.id} id={section.anchor} className={related.length ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/10' : 'bg-background/90'}>
            <CardContent className="py-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{section.sectionType}</Badge>
                {section.headingNumber && <Badge variant="secondary">{section.headingNumber}</Badge>}
                {related.length > 0 && <Badge variant="default"><Sparkles className="mr-1 h-3 w-3" /> Подсветка анализа</Badge>}
              </div>
              <h3 className="font-semibold leading-7">{section.title}</h3>
              {related.length > 0 && (
                <div className="my-3 space-y-2 rounded-lg border bg-background/80 p-3 text-sm">
                  {related.map((item, index) => <div key={index}><p className="font-medium">{renderValue(item.title) || renderValue(item.kind)}</p><p className="text-muted-foreground">{renderValue(item.importance) || renderValue(item.quote)}</p></div>)}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{section.text}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
