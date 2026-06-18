'use client';

import { Application } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { formatUnitLabel, getStringValue, parseJson } from '@/components/applicant/wizard/parameter-value-helpers';

export function renderCustomParameter(
  id: string,
  values: Application['values'],
  onChange: (id: string, value: string | string[]) => void
) {
  if (id === 'param-export-trade-names') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Торговое наименование на экспорт</Label>
        <ExportTradeNamesTable value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-administration-routes') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Способы введения</Label>
        <AdministrationRoutesList value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-composition-table') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Полный качественный и количественный состав</Label>
        <CompositionTable value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-packaging') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Упаковка</Label>
        <PackagingTable value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-foreign-registrations') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Регистрация в стране-производителе и других странах</Label>
        <ForeignRegistrationsTable value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-patent-trademark') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Правовая охрана</Label>
        <LegalProtectionTable value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-manufacturers') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Производитель лекарственного препарата и участки производства</Label>
        <ManufacturersBlock value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-production-sites') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Производство лекарственного препарата</Label>
        <ProductionSitesBlock value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  if (id === 'param-variation-changes-table') {
    return (
      <div key={id} className="space-y-2 sm:col-span-2">
        <Label>Изменения, вносимые в досье</Label>
        <VariationChangesTable value={getStringValue(values[id])} onChange={(value) => onChange(id, value)} />
      </div>
    );
  }

  return null;
}

const countryOptions = [
  { value: 'KZ', label: 'Казахстан' },
  { value: 'RU', label: 'Россия' },
  { value: 'BY', label: 'Беларусь' },
  { value: 'AM', label: 'Армения' },
  { value: 'KG', label: 'Кыргызстан' },
  { value: 'UZ', label: 'Узбекистан' },
  { value: 'other', label: 'Другая страна' },
];

const administrationRouteOptions = [
  { value: 'oral', label: 'Перорально' },
  { value: 'parenteral', label: 'Парентерально' },
  { value: 'topical', label: 'Местно' },
  { value: 'inhalation', label: 'Ингаляционно' },
  { value: 'intravenous', label: 'Внутривенно' },
  { value: 'intramuscular', label: 'Внутримышечно' },
  { value: 'subcutaneous', label: 'Подкожно' },
];

const variationDirectory = [
  { id: 'type-ia-labeling', label: 'Тип IA. Маркировка / редакционные изменения', type: 'IA' },
  { id: 'type-ib-quality', label: 'Тип IB. Качество / НД / производство', type: 'IB' },
  { id: 'type-ii-spc', label: 'Тип II. ОХЛП / инструкция / значимые изменения', type: 'II' },
  { id: 'new-registration', label: 'Изменение, требующее новой регистрации', type: 'Новая регистрация' },
];

const manufacturerTypeOptions = [
  { value: 'finished-product', label: 'Производитель готового ЛП' },
  { value: 'api', label: 'Производитель АФС' },
  { value: 'primary-packaging', label: 'Первичная упаковка' },
  { value: 'secondary-packaging', label: 'Вторичная упаковка' },
  { value: 'quality-control', label: 'Контроль качества' },
  { value: 'batch-release', label: 'Выпускающий контроль' },
  { value: 'solvent-component', label: 'Компонент / растворитель' },
  { value: 'other', label: 'Другое' },
];

const organizationalFormOptions = [
  { value: 'state-enterprise', label: 'Государственное предприятие' },
  { value: 'llp', label: 'ТОО' },
  { value: 'jsc', label: 'АО' },
  { value: 'llc', label: 'LLC' },
  { value: 'gmbh', label: 'GmbH' },
  { value: 'ltd', label: 'Ltd' },
  { value: 'other', label: 'Другая форма' },
];

const productionModeOptions = [
  { value: 'full-current', label: 'Полностью на данном производстве' },
  { value: 'partial-current', label: 'Частично на данном производстве' },
  { value: 'full-other', label: 'Полностью на другом производстве' },
];

type ExportNameRow = { country: string; nameKz: string; nameRu: string; nameEn: string };
type PackagingRow = { name: string; primary: string; fillVolume: string; unit: string; unitCount: string; description: string; mockup: string };
type ForeignRegistrationRow = { country: string; certificateNumber: string; issueDate: string; expiryDate: string; unlimited: string };
type LegalProtectionRow = { documentType: string; objectName: string; documentNumber: string; issueDate: string; expiryDate: string; rightHolder: string; comment: string };
type ManufacturerRow = {
  manufacturerType: string;
  organizationalForm: string;
  country: string;
  absentInDirectory: string;
  nameRu: string;
  nameKz: string;
  nameEn: string;
  permitNumber: string;
  permitIssueDate: string;
  permitExpiryDate: string;
  headLastName: string;
  headFirstName: string;
  headMiddleName: string;
  headPosition: string;
  phone: string;
  email: string;
  contactLastName: string;
  contactFirstName: string;
  contactMiddleName: string;
  contactPosition: string;
  legalAddress: string;
  actualAddress: string;
};
type ProductionSiteRow = {
  manufacturerType: string;
  nameKz: string;
  nameRu: string;
  nameEn: string;
  country: string;
  permitNumber: string;
  permitIssueDate: string;
  permitExpiryDate: string;
  legalAddress: string;
  actualAddress: string;
  phoneFaxEmail: string;
  headFullName: string;
  headPosition: string;
  contactFullName: string;
  contactPosition: string;
};
type ProductionSitesValue = { mode: string; rows: ProductionSiteRow[] };
type CompositionRow = { substanceType: string; name: string; quantity: string; unit: string; normativeDocument: string; manufacturer: string };
type VariationChangeRow = { directoryId: string; changeType: string; before: string; after: string };

function ExportTradeNamesTable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<ExportNameRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<ExportNameRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, { country: 'KZ', nameKz: '', nameRu: '', nameEn: '' }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Экспортные наименования не добавлены.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-lg border bg-background p-3 lg:grid-cols-[160px_1fr_1fr_1fr_auto]">
          <Select value={row.country} onValueChange={(country) => updateRow(index, { country })}>
            <SelectTrigger><SelectValue placeholder="Страна" /></SelectTrigger>
            <SelectContent>{countryOptions.map((country) => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={row.nameKz} onChange={(event) => updateRow(index, { nameKz: event.target.value })} placeholder="Наименование на государственном языке" />
          <Input value={row.nameRu} onChange={(event) => updateRow(index, { nameRu: event.target.value })} placeholder="Наименование на русском языке" />
          <Input value={row.nameEn} onChange={(event) => updateRow(index, { nameEn: event.target.value })} placeholder="Наименование на английском языке" />
          <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить экспортное наименование"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>
    </div>
  );
}

function AdministrationRoutesList({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const routes = parseJson<string[]>(value, []);
  const updateRoute = (index: number, route: string) => onChange(JSON.stringify(routes.map((item, i) => (i === index ? route : item))));
  const addRoute = () => onChange(JSON.stringify([...routes, 'oral']));
  const removeRoute = (index: number) => onChange(JSON.stringify(routes.filter((_, i) => i !== index)));

  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
      {routes.map((route, index) => (
        <div key={index} className="flex gap-2">
          <Select value={route} onValueChange={(next) => updateRoute(index, next)}>
            <SelectTrigger><SelectValue placeholder="Выберите путь введения" /></SelectTrigger>
            <SelectContent>{administrationRouteOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => removeRoute(index)} aria-label="Удалить путь введения"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {routes.length === 0 && <p className="text-sm text-muted-foreground">Пути введения не выбраны.</p>}
      <Button type="button" variant="outline" size="sm" onClick={addRoute}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>
    </div>
  );
}

function PackagingTable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<PackagingRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<PackagingRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, { name: '', primary: 'yes', fillVolume: '', unit: 'ml', unitCount: '', description: '', mockup: '' }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 border bg-muted/20 p-3">
      <div className="overflow-x-auto border">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="border px-2 py-2 font-medium">ИД</th>
              <th className="border px-2 py-2 font-medium">Наименование упаковки</th>
              <th className="border px-2 py-2 font-medium">Первичная</th>
              <th className="border px-2 py-2 font-medium">Объем заполнения</th>
              <th className="border px-2 py-2 font-medium">Единица измерения</th>
              <th className="border px-2 py-2 font-medium">Количество единиц</th>
              <th className="border px-2 py-2 font-medium">Описание</th>
              <th className="border px-2 py-2 font-medium">Макет</th>
              <th className="border px-2 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="w-14 border px-2 py-2 text-muted-foreground">{index + 1}</td>
                <td className="min-w-[190px] border px-2 py-2">
                  <Input value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} placeholder="Например, флакон, блистер, ампула" />
                </td>
                <td className="min-w-[130px] border px-2 py-2">
                  <Select value={row.primary || 'yes'} onValueChange={(primary) => updateRow(index, { primary })}>
                    <SelectTrigger><SelectValue placeholder="Первичная" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Да</SelectItem>
                      <SelectItem value="no">Нет</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="min-w-[140px] border px-2 py-2">
                  <Input value={row.fillVolume} onChange={(event) => updateRow(index, { fillVolume: event.target.value })} placeholder="Например, 5" />
                </td>
                <td className="min-w-[150px] border px-2 py-2">
                  <Select value={row.unit || 'ml'} onValueChange={(unit) => updateRow(index, { unit })}>
                    <SelectTrigger><SelectValue placeholder="Ед." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ml">мл</SelectItem>
                      <SelectItem value="l">л</SelectItem>
                      <SelectItem value="mg">мг</SelectItem>
                      <SelectItem value="g">г</SelectItem>
                      <SelectItem value="tablets">таблетки</SelectItem>
                      <SelectItem value="capsules">капсулы</SelectItem>
                      <SelectItem value="doses">дозы</SelectItem>
                      <SelectItem value="pcs">шт.</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="min-w-[150px] border px-2 py-2">
                  <Input value={row.unitCount} onChange={(event) => updateRow(index, { unitCount: event.target.value })} placeholder="Количество" />
                </td>
                <td className="min-w-[220px] border px-2 py-2">
                  <Input value={row.description} onChange={(event) => updateRow(index, { description: event.target.value })} placeholder="Описание / GTIN" />
                </td>
                <td className="min-w-[160px] border px-2 py-2">
                  <Input value={row.mockup} onChange={(event) => updateRow(index, { mockup: event.target.value })} placeholder="Макет, jpg" />
                </td>
                <td className="w-12 border px-2 py-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить упаковку"><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="border px-2 py-3 text-sm text-muted-foreground">Всего записей: 0</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>
    </div>
  );
}

function ForeignRegistrationsTable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<ForeignRegistrationRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<ForeignRegistrationRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, { country: 'KZ', certificateNumber: '', issueDate: '', expiryDate: '', unlimited: 'no' }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 border bg-muted/20 p-3">
      <div className="overflow-x-auto border">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="border px-2 py-2 font-medium">Страна</th>
              <th className="border px-2 py-2 font-medium">№ регистрационного удостоверения (при наличии)</th>
              <th className="border px-2 py-2 font-medium">Дата выдачи</th>
              <th className="border px-2 py-2 font-medium">Срок действия</th>
              <th className="border px-2 py-2 font-medium">Бессрочно</th>
              <th className="border px-2 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="min-w-[180px] border px-2 py-2">
                  <Select value={row.country || 'KZ'} onValueChange={(country) => updateRow(index, { country })}>
                    <SelectTrigger><SelectValue placeholder="Страна" /></SelectTrigger>
                    <SelectContent>{countryOptions.map((country) => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="min-w-[260px] border px-2 py-2">
                  <Input value={row.certificateNumber} onChange={(event) => updateRow(index, { certificateNumber: event.target.value })} placeholder="№ РУ" />
                </td>
                <td className="min-w-[150px] border px-2 py-2">
                  <Input type="date" value={row.issueDate} onChange={(event) => updateRow(index, { issueDate: event.target.value })} />
                </td>
                <td className="min-w-[150px] border px-2 py-2">
                  <Input type="date" value={row.expiryDate} disabled={row.unlimited === 'yes'} onChange={(event) => updateRow(index, { expiryDate: event.target.value })} />
                </td>
                <td className="min-w-[130px] border px-2 py-2">
                  <Select value={row.unlimited || 'no'} onValueChange={(unlimited) => updateRow(index, { unlimited, expiryDate: unlimited === 'yes' ? '' : row.expiryDate })}>
                    <SelectTrigger><SelectValue placeholder="Бессрочно" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Нет</SelectItem>
                      <SelectItem value="yes">Да</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="w-12 border px-2 py-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить регистрацию"><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="border px-2 py-3 text-sm text-muted-foreground">Всего записей: 0</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>
    </div>
  );
}

function LegalProtectionTable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<LegalProtectionRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<LegalProtectionRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, { documentType: 'patent', objectName: '', documentNumber: '', issueDate: '', expiryDate: '', rightHolder: '', comment: '' }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 border bg-muted/20 p-3">
      <div className="overflow-x-auto border">
        <table className="min-w-[1120px] w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="border px-2 py-2 font-medium">Вид документа</th>
              <th className="border px-2 py-2 font-medium">Объект / наименование</th>
              <th className="border px-2 py-2 font-medium">№ документа</th>
              <th className="border px-2 py-2 font-medium">Дата выдачи</th>
              <th className="border px-2 py-2 font-medium">Срок действия</th>
              <th className="border px-2 py-2 font-medium">Правообладатель</th>
              <th className="border px-2 py-2 font-medium">Комментарий</th>
              <th className="border px-2 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="min-w-[210px] border px-2 py-2">
                  <Select value={row.documentType || 'patent'} onValueChange={(documentType) => updateRow(index, { documentType })}>
                    <SelectTrigger><SelectValue placeholder="Вид документа" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patent">Патент</SelectItem>
                      <SelectItem value="trademark">Товарный знак</SelectItem>
                      <SelectItem value="license">Лицензионный договор</SelectItem>
                      <SelectItem value="no-infringement">Подтверждение отсутствия нарушения прав</SelectItem>
                      <SelectItem value="other">Другое</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="min-w-[220px] border px-2 py-2">
                  <Input value={row.objectName} onChange={(event) => updateRow(index, { objectName: event.target.value })} placeholder="Наименование ЛС / знак / объект" />
                </td>
                <td className="min-w-[160px] border px-2 py-2">
                  <Input value={row.documentNumber} onChange={(event) => updateRow(index, { documentNumber: event.target.value })} placeholder="№ документа" />
                </td>
                <td className="min-w-[145px] border px-2 py-2">
                  <Input type="date" value={row.issueDate} onChange={(event) => updateRow(index, { issueDate: event.target.value })} />
                </td>
                <td className="min-w-[145px] border px-2 py-2">
                  <Input type="date" value={row.expiryDate} onChange={(event) => updateRow(index, { expiryDate: event.target.value })} />
                </td>
                <td className="min-w-[190px] border px-2 py-2">
                  <Input value={row.rightHolder} onChange={(event) => updateRow(index, { rightHolder: event.target.value })} placeholder="Правообладатель" />
                </td>
                <td className="min-w-[240px] border px-2 py-2">
                  <Input value={row.comment} onChange={(event) => updateRow(index, { comment: event.target.value })} placeholder="Комментарий" />
                </td>
                <td className="w-12 border px-2 py-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить запись правовой охраны"><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="border px-2 py-3 text-sm text-muted-foreground">Всего записей: 0</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>
    </div>
  );
}

function emptyManufacturer(): ManufacturerRow {
  return {
    manufacturerType: 'finished-product',
    organizationalForm: 'state-enterprise',
    country: 'KZ',
    absentInDirectory: 'no',
    nameRu: '',
    nameKz: '',
    nameEn: '',
    permitNumber: '',
    permitIssueDate: '',
    permitExpiryDate: '',
    headLastName: '',
    headFirstName: '',
    headMiddleName: '',
    headPosition: '',
    phone: '',
    email: '',
    contactLastName: '',
    contactFirstName: '',
    contactMiddleName: '',
    contactPosition: '',
    legalAddress: '',
    actualAddress: '',
  };
}

function ManufacturersBlock({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<ManufacturerRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<ManufacturerRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, emptyManufacturer()]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 border bg-muted/20 p-3">
      {rows.map((row, index) => (
        <div key={index} className="space-y-4 border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Производитель {index + 1}</p>
            <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить производителя"><Trash2 className="h-4 w-4" /></Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <FieldSelect label="Тип производителя" value={row.manufacturerType} options={manufacturerTypeOptions} onChange={(manufacturerType) => updateRow(index, { manufacturerType })} />
            <FieldSelect label="Организационная форма" value={row.organizationalForm} options={organizationalFormOptions} onChange={(organizationalForm) => updateRow(index, { organizationalForm })} />
            <FieldSelect label="Страна" value={row.country} options={countryOptions} onChange={(country) => updateRow(index, { country })} />
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <FieldSelect label="Отсутствует в справочнике" value={row.absentInDirectory || 'no'} options={[{ value: 'no', label: 'Нет' }, { value: 'yes', label: 'Да' }]} onChange={(absentInDirectory) => updateRow(index, { absentInDirectory })} />
            <FieldInput label="Наименование на русском языке" value={row.nameRu} onChange={(nameRu) => updateRow(index, { nameRu })} />
            <FieldInput label="Наименование на казахском языке" value={row.nameKz} onChange={(nameKz) => updateRow(index, { nameKz })} />
            <FieldInput label="Наименование на английском языке" value={row.nameEn} onChange={(nameEn) => updateRow(index, { nameEn })} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <FieldInput label="№ разрешительного документа" value={row.permitNumber} onChange={(permitNumber) => updateRow(index, { permitNumber })} />
            <FieldInput label="Дата выдачи" type="date" value={row.permitIssueDate} onChange={(permitIssueDate) => updateRow(index, { permitIssueDate })} />
            <FieldInput label="Срок действия" type="date" value={row.permitExpiryDate} onChange={(permitExpiryDate) => updateRow(index, { permitExpiryDate })} />
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <FieldInput label="Фамилия первого руководителя" value={row.headLastName} onChange={(headLastName) => updateRow(index, { headLastName })} />
            <FieldInput label="Имя первого руководителя" value={row.headFirstName} onChange={(headFirstName) => updateRow(index, { headFirstName })} />
            <FieldInput label="Отчество первого руководителя" value={row.headMiddleName} onChange={(headMiddleName) => updateRow(index, { headMiddleName })} />
            <FieldInput label="Должность первого руководителя" value={row.headPosition} onChange={(headPosition) => updateRow(index, { headPosition })} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FieldInput label="Телефон" value={row.phone} onChange={(phone) => updateRow(index, { phone })} />
            <FieldInput label="Электронная почта" type="email" value={row.email} onChange={(email) => updateRow(index, { email })} />
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <FieldInput label="Фамилия контактного лица" value={row.contactLastName} onChange={(contactLastName) => updateRow(index, { contactLastName })} />
            <FieldInput label="Имя контактного лица" value={row.contactFirstName} onChange={(contactFirstName) => updateRow(index, { contactFirstName })} />
            <FieldInput label="Отчество контактного лица" value={row.contactMiddleName} onChange={(contactMiddleName) => updateRow(index, { contactMiddleName })} />
            <FieldInput label="Должность контактного лица" value={row.contactPosition} onChange={(contactPosition) => updateRow(index, { contactPosition })} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FieldInput label="Юридический адрес" value={row.legalAddress} onChange={(legalAddress) => updateRow(index, { legalAddress })} />
            <FieldInput label="Фактический адрес" value={row.actualAddress} onChange={(actualAddress) => updateRow(index, { actualAddress })} />
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Производители не добавлены.</p>}
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить производителя</Button>
    </div>
  );
}

function FieldInput({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={label} />
    </div>
  );
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value || options[0]?.value || ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function emptyProductionSite(): ProductionSiteRow {
  return {
    manufacturerType: 'finished-product',
    nameKz: '',
    nameRu: '',
    nameEn: '',
    country: 'KZ',
    permitNumber: '',
    permitIssueDate: '',
    permitExpiryDate: '',
    legalAddress: '',
    actualAddress: '',
    phoneFaxEmail: '',
    headFullName: '',
    headPosition: '',
    contactFullName: '',
    contactPosition: '',
  };
}

function parseProductionSitesValue(value: string): ProductionSitesValue {
  const fallback: ProductionSitesValue = { mode: 'full-current', rows: [] };
  const parsed = parseJson<ProductionSitesValue | ProductionSiteRow[]>(value, fallback);
  if (Array.isArray(parsed)) return { mode: 'full-current', rows: parsed };
  return {
    mode: parsed?.mode || 'full-current',
    rows: Array.isArray(parsed?.rows) ? parsed.rows : [],
  };
}

function ProductionSitesBlock({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const state = parseProductionSitesValue(value);
  const updateState = (patch: Partial<ProductionSitesValue>) => onChange(JSON.stringify({ ...state, ...patch }));
  const updateRow = (index: number, patch: Partial<ProductionSiteRow>) => updateState({ rows: state.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const addRow = () => updateState({ rows: [...state.rows, emptyProductionSite()] });
  const removeRow = (index: number) => updateState({ rows: state.rows.filter((_, i) => i !== index) });

  return (
    <div className="space-y-3 border bg-muted/20 p-3">
      <div className="grid gap-2 lg:grid-cols-3">
        {productionModeOptions.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 border bg-background px-3 py-2 text-sm">
            <input
              type="radio"
              name="param-production-sites-mode"
              value={option.value}
              checked={state.mode === option.value}
              onChange={() => updateState({ mode: option.value })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto border">
        <table className="min-w-[1400px] w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="border px-2 py-2 font-medium">№</th>
              <th className="border px-2 py-2 font-medium">Тип производителя</th>
              <th className="border px-2 py-2 font-medium">Наименование / страна</th>
              <th className="border px-2 py-2 font-medium">№, дата и срок разрешительного документа</th>
              <th className="border px-2 py-2 font-medium">Юридический адрес</th>
              <th className="border px-2 py-2 font-medium">Фактический адрес</th>
              <th className="border px-2 py-2 font-medium">Телефон, факс, e-mail</th>
              <th className="border px-2 py-2 font-medium">Ф.И.О. и должность руководителя</th>
              <th className="border px-2 py-2 font-medium">Ф.И.О. и должность контактного лица</th>
              <th className="border px-2 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row, index) => (
              <tr key={index} className="align-top">
                <td className="w-12 border px-2 py-2 text-muted-foreground">{index + 1}</td>
                <td className="min-w-[200px] border px-2 py-2">
                  <Select value={row.manufacturerType || 'finished-product'} onValueChange={(manufacturerType) => updateRow(index, { manufacturerType })}>
                    <SelectTrigger><SelectValue placeholder="Тип производителя" /></SelectTrigger>
                    <SelectContent>{manufacturerTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="min-w-[240px] space-y-2 border px-2 py-2">
                  <Input value={row.nameKz} onChange={(event) => updateRow(index, { nameKz: event.target.value })} placeholder="Наименование на казахском языке" />
                  <Input value={row.nameRu} onChange={(event) => updateRow(index, { nameRu: event.target.value })} placeholder="Наименование на русском языке" />
                  <Input value={row.nameEn} onChange={(event) => updateRow(index, { nameEn: event.target.value })} placeholder="Наименование на английском языке" />
                  <Select value={row.country || 'KZ'} onValueChange={(country) => updateRow(index, { country })}>
                    <SelectTrigger><SelectValue placeholder="Страна" /></SelectTrigger>
                    <SelectContent>{countryOptions.map((country) => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="min-w-[210px] space-y-2 border px-2 py-2">
                  <Input value={row.permitNumber} onChange={(event) => updateRow(index, { permitNumber: event.target.value })} placeholder="№ разрешительного документа" />
                  <Input type="date" value={row.permitIssueDate} onChange={(event) => updateRow(index, { permitIssueDate: event.target.value })} />
                  <Input type="date" value={row.permitExpiryDate} onChange={(event) => updateRow(index, { permitExpiryDate: event.target.value })} />
                </td>
                <td className="min-w-[200px] border px-2 py-2">
                  <Textarea value={row.legalAddress} onChange={(event) => updateRow(index, { legalAddress: event.target.value })} placeholder="Юридический адрес" />
                </td>
                <td className="min-w-[200px] border px-2 py-2">
                  <Textarea value={row.actualAddress} onChange={(event) => updateRow(index, { actualAddress: event.target.value })} placeholder="Фактический адрес" />
                </td>
                <td className="min-w-[190px] border px-2 py-2">
                  <Textarea value={row.phoneFaxEmail} onChange={(event) => updateRow(index, { phoneFaxEmail: event.target.value })} placeholder="Телефон, факс, e-mail" />
                </td>
                <td className="min-w-[220px] space-y-2 border px-2 py-2">
                  <Input value={row.headFullName} onChange={(event) => updateRow(index, { headFullName: event.target.value })} placeholder="Ф.И.О. руководителя" />
                  <Input value={row.headPosition} onChange={(event) => updateRow(index, { headPosition: event.target.value })} placeholder="Должность руководителя" />
                </td>
                <td className="min-w-[220px] space-y-2 border px-2 py-2">
                  <Input value={row.contactFullName} onChange={(event) => updateRow(index, { contactFullName: event.target.value })} placeholder="Ф.И.О. контактного лица" />
                  <Input value={row.contactPosition} onChange={(event) => updateRow(index, { contactPosition: event.target.value })} placeholder="Должность контактного лица" />
                </td>
                <td className="w-12 border px-2 py-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить строку производства"><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {state.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="border px-2 py-3 text-sm text-muted-foreground">Всего записей: 0</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить строку</Button>
    </div>
  );
}

function CompositionTable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<CompositionRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<CompositionRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, { substanceType: '', name: '', quantity: '', unit: 'mg', normativeDocument: '', manufacturer: '' }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Строки состава не добавлены.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-lg border bg-background p-3 lg:grid-cols-6">
          <Input value={row.substanceType} onChange={(event) => updateRow(index, { substanceType: event.target.value })} placeholder="Тип вещества" />
          <Input value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} placeholder="Наименование" />
          <Input type="number" value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} placeholder="Количество" />
          <Select value={row.unit} onValueChange={(unit) => updateRow(index, { unit })}>
            <SelectTrigger><SelectValue placeholder="Ед." /></SelectTrigger>
            <SelectContent>{['mg', 'g', 'mcg', 'ml', 'percent', 'iu'].map((unit) => <SelectItem key={unit} value={unit}>{formatUnitLabel(unit)}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={row.normativeDocument} onChange={(event) => updateRow(index, { normativeDocument: event.target.value })} placeholder="НД" />
          <div className="flex gap-2">
            <Input value={row.manufacturer} onChange={(event) => updateRow(index, { manufacturer: event.target.value })} placeholder="Производитель" />
            <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить строку состава"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>
    </div>
  );
}

function VariationChangesTable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = parseJson<VariationChangeRow[]>(value, []);
  const updateRow = (index: number, patch: Partial<VariationChangeRow>) => onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  const addRow = () => onChange(JSON.stringify([...rows, { directoryId: '', changeType: '', before: '', after: '' }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Изменения не добавлены.</p>}
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded-lg border bg-background p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_auto]">
            <Select value={row.directoryId} onValueChange={(directoryId) => {
              const item = variationDirectory.find((entry) => entry.id === directoryId);
              updateRow(index, { directoryId, changeType: item?.type || '' });
            }}>
              <SelectTrigger><SelectValue placeholder="Выбрать из справочника" /></SelectTrigger>
              <SelectContent>{variationDirectory.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={row.changeType} readOnly placeholder="Вид изменения" className="bg-muted/50" />
            <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} aria-label="Удалить изменение"><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            <Textarea value={row.before} onChange={(event) => updateRow(index, { before: event.target.value })} placeholder="Редакция до внесения изменений" />
            <Textarea value={row.after} onChange={(event) => updateRow(index, { after: event.target.value })} placeholder="Предлагаемые изменения" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-4 w-4" />Добавить изменение</Button>
    </div>
  );
}
