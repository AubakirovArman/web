import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn, SlideIn, Stagger, StaggerItem } from '@/components/shared/motion';
import { FileCheck, BrainCircuit, ShieldCheck, Clock, FlaskConical } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">
          {/* Герой — на всю ширину, выровнен по левому краю */}
          <section className="border-b bg-muted/30 px-6 py-10 lg:py-14">
            <FadeIn>
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                  <FlaskConical className="h-3.5 w-3.5 text-primary" />
                  <span>MVP для фармацевтической экспертизы</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
                  Предэкспертиза регистрационного досье с помощью ИИ
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  Система автоматически проверяет комплектность документов, сверяет данные между файлами и
                  сопоставляет их с требованиями НПА — выявляя расхождения до передачи дела эксперту.
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Начните работу через меню слева: <span className="font-medium text-foreground">«Создать заявку»</span> —
                  для заявителя, <span className="font-medium text-foreground">«Эксперт»</span> — для экспертизы дел.
                </p>
              </div>
            </FadeIn>
          </section>

          {/* Возможности */}
          <section className="px-6 py-8">
            <SlideIn className="mb-5">
              <h2 className="text-lg font-semibold tracking-tight">Что делает система</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Проверяет заявку по правилам на основе нормативных актов ЕАЭС и РК.
              </p>
            </SlideIn>
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StaggerItem className="h-full">
                <FeatureCard
                  icon={<FileCheck className="h-5 w-5" />}
                  title="Комплектность"
                  description="Определяет обязательный пакет документов по типу процедуры, продукта и параметрам заявки."
                />
              </StaggerItem>
              <StaggerItem className="h-full">
                <FeatureCard
                  icon={<BrainCircuit className="h-5 w-5" />}
                  title="ИИ-проверка"
                  description="Извлекает факты из PDF и DOCX, ищет расхождения сроков годности, условий хранения и адресов."
                />
              </StaggerItem>
              <StaggerItem className="h-full">
                <FeatureCard
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="НПА-ориентир"
                  description="Каждое замечание сопровождается ссылкой на нормативный документ и рекомендацией."
                />
              </StaggerItem>
              <StaggerItem className="h-full">
                <FeatureCard
                  icon={<Clock className="h-5 w-5" />}
                  title="Экономия времени"
                  description="Заявитель видит замечания до подачи, эксперт получает предварительный протокол."
                />
              </StaggerItem>
            </Stagger>
          </section>
        </main>

        <footer className="border-t px-6 py-4 text-xs text-muted-foreground">
          NDDA AI — MVP предэкспертизы регистрационного досье. Данные хранятся в защищённой базе данных.
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
