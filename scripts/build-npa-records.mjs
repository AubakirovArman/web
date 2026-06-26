import fs from 'node:fs';

const META = {
  '/tmp/prev113.json': { id: 'npa-reshenie-113', name: 'Решение Совета ЕЭК № 113 от 17.07.2018', actType: 'Решение Совета ЕЭК', number: '113', date: '2018-07-17' },
  '/tmp/prev87.json': { id: 'npa-reshenie-87', name: 'Решение Совета ЕЭК № 87 от 03.11.2016', actType: 'Решение Совета ЕЭК', number: '87', date: '2016-11-03' },
  '/tmp/prevdsm10.json': { id: 'npa-prikaz-dsm-10', name: 'Приказ МЗ РК № ҚР ДСМ-10 от 27.01.2021', actType: 'Приказ', number: 'ДСМ-10', date: '2021-01-27' },
};

function mapReq(r, recId, i) {
  return {
    id: `${recId}-req-${i + 1}`,
    source: 'gemma',
    code: String(r.document_code || ''),
    point: String(r.source_point || ''),
    requirement: String(r.requirement_text || ''),
    criticality: String(r.criticality || 'неясно'),
    action: 'accepted',
    documentCode: String(r.document_code || ''),
    documentName: String(r.document_name || ''),
    checkType: String(r.check_type || ''),
    condition: String(r.applicability_condition || ''),
    quote: String(r.quote || ''),
  };
}

const newRecords = [];
for (const [file, meta] of Object.entries(META)) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (p.error) { console.error('ОШИБКА в', file, p.error); process.exit(1); }
  const reqs = (p.extraction?.requirements || []).map((r, i) => mapReq(r, meta.id, i));
  newRecords.push({
    id: meta.id,
    name: meta.name,
    actType: meta.actType,
    number: meta.number,
    date: meta.date,
    revision: '',
    fileName: p.document?.fileName || '',
    area: p.extraction?.area || 'ЛС',
    requirements: reqs,
    createdAt: '2026-06-26T00:00:00.000Z',
  });
  console.log(`  ${meta.id}: ${reqs.length} требований`);
}

// существующие записи — из живой БД (дамп /tmp/cur_registry.json)
const cur = JSON.parse(fs.readFileSync('/tmp/cur_registry.json', 'utf8'));
const existing = Array.isArray(cur) ? cur : [];
console.log('существующих записей:', existing.length, '→', existing.map((x) => x.id).join(', '));

const existingIds = new Set(existing.map((x) => x.id));
const merged = [...existing, ...newRecords.filter((r) => !existingIds.has(r.id))];

fs.writeFileSync('/tmp/new_npa_registry.json', JSON.stringify(merged));
console.log('итого записей в новом реестре:', merged.length);
console.log('новый реестр:', merged.map((x) => `${x.id}(${(x.requirements || []).length})`).join(', '));
