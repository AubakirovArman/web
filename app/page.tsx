import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn, SlideIn, Stagger, StaggerItem } from '@/components/shared/motion';
import { FileCheck, BrainCircuit, ShieldCheck, Clock, ArrowRight, FlaskConical } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-muted/30 py-24 lg:py-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <FadeIn>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm">
                  <FlaskConical className="h-4 w-4" />
                  <span>МVP для фармацевтической экспертизы</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Предэкспертиза регистрационного досье с помощью ИИ
                </h1>
                <p className="mt-6 text-lg text-muted-foreground">
                  Автоматическая проверка комплектности документов, выявление расхождений между файлами и ссылками на НПА
                  до передачи дела эксперту.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Button asChild size="lg">
                    <Link href="/wizard">
                      Создать заявку
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild size="lg">
                    <Link href="/expert">Кабинет эксперта</Link>
                  </Button>
                  <Button variant="secondary" asChild size="lg">
                    <Link href="/demo">Сгенерировать демо и прогнать проверки</Link>
                  </Button>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-28">
          <div className="container mx-auto px-4">
            <SlideIn className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">Что делает система</h2>
              <p className="mt-4 text-muted-foreground">Проверяет заявку по правилам, основанным на нормативных актах ЕАЭС и РК</p>
            </SlideIn>
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StaggerItem>
                <FeatureCard
                  icon={<FileCheck className="h-6 w-6" />}
                  title="Комплектность"
                  description="Определяет обязательный пакет документов по типу процедуры, продукта и параметрам."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<BrainCircuit className="h-6 w-6" />}
                  title="ИИ-проверка"
                  description="Извлекает факты из PDF и DOCX, ищет расхождения сроков годности, условий хранения, адресов."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<ShieldCheck className="h-6 w-6" />}
                  title="НПА-ориентир"
                  description="Каждое замечание сопровождается ссылкой на нормативный документ и рекомендацией."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Clock className="h-6 w-6" />}
                  title="Экономия времени"
                  description="Заявитель видит замечания до подачи, эксперт получает предварительный протокол."
                />
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <SlideIn className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Начните с демо-сценария</h2>
              <p className="mt-4 text-muted-foreground">
                Откройте кабинет заявителя и посмотрите, как система проверит generic-препарат в таблетках 500 мг.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/wizard">Перейти к заявке</Link>
              </Button>
            </SlideIn>
          </div>
        </section>
      </main>
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          NDDA AI — MVP предэкспертизы регистрационного досье. Данные хранятся локально в браузере.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
