import { NextRequest, NextResponse } from 'next/server';
import { getRequiredParameterIds, getVisibleParameterIds, parameters } from '@/lib/data/seed';
import { readAdminApplicationFieldsView } from '@/lib/admin/server-store';
import { readCustomParameters, upsertCustomParameter } from '@/lib/admin/custom-fields-store';
import { logAudit } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const usageLabels = {
  condition_for_document_upload: 'Условие отображения документов',
  reference_or_validation: 'Сверка / справочная проверка',
  core_route: 'Базовая маршрутизация заявки',
} as const;

const conditionParameterIds = new Set([
  'param-dossier-type',
  'param-manufacturer-country',
  'param-expertise-mode',
  'param-product-type',
  'param-dosage-form',
  'param-dispensing',
  'param-applicant',
  'param-manufacturer',
  'param-manufacturer-address',
]);

function getUsage(paramId: string) {
  if (paramId === 'param-object-type' || paramId === 'param-procedure') return 'core_route';
  if (conditionParameterIds.has(paramId)) return 'condition_for_document_upload';
  return 'reference_or_validation';
}

function renderOptions(param: any) {
  if (!param.options?.length) return 'Свободный ввод';
  return param.options.map((option: any) => `${option.value} — ${option.label}`).join('; ');
}

export async function GET() {
  try {
    const links = await readAdminApplicationFieldsView();
    const relatedByParam = new Map<string, Array<{ code: string; name: string }>>();
    for (const link of links) {
      for (const paramId of link.linkedParams) {
        const bucket = relatedByParam.get(paramId) || [];
        bucket.push({ code: link.code, name: link.name });
        relatedByParam.set(paramId, bucket);
      }
    }
    const visibleIds = getVisibleParameterIds('LS', 'registration');
    const requiredIds = new Set(getRequiredParameterIds('LS', 'registration'));
    const byId = new Map(parameters.map((item) => [item.id, item]));
    const rows = visibleIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((param: any) => {
        const relatedDocuments = relatedByParam.get(param.id) || [];
        const usage = relatedDocuments.length ? 'condition_for_document_upload' : getUsage(param.id);
        return {
          id: param.id,
          label: param.label,
          type: param.type,
          section: param.section,
          sourceFieldRef: param.sourceFieldRef,
          sourceNpa: param.sourceNpa,
          required: requiredIds.has(param.id),
          usage,
          usageLabel: usageLabels[usage as keyof typeof usageLabels],
          optionsText: renderOptions(param),
          relatedDocuments,
          isCustom: false,
        };
      });

    // Кастомные поля (self-service) — показываем ниже, с флагом isCustom для CRUD в UI.
    const customFields = await readCustomParameters();
    const customRows = customFields.map((param) => ({
      id: param.id,
      label: param.label,
      type: param.type,
      section: param.section,
      sourceFieldRef: param.sourceFieldRef,
      sourceNpa: param.sourceNpa,
      required: false,
      usage: 'condition_for_document_upload' as const,
      usageLabel: usageLabels.condition_for_document_upload,
      optionsText: renderOptions(param),
      relatedDocuments: relatedByParam.get(param.id) || [],
      isCustom: true,
      scopeObjectType: param.scopeObjectType,
    }));

    return NextResponse.json({ rows: [...rows, ...customRows], customFields });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read fields' }, { status: 500 });
  }
}

// Создать кастомное поле заявки.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const label = String(body?.label || '').trim();
    if (!label) return NextResponse.json({ error: 'Укажите название поля' }, { status: 400 });
    const userId = request.headers.get('x-user-id') || 'system';
    const result = await upsertCustomParameter(
      {
        label,
        type: body?.type,
        options: body?.options,
        section: body?.section,
        scopeObjectType: body?.scopeObjectType,
        sourceNpa: body?.sourceNpa,
        sourceFieldRef: body?.sourceFieldRef,
      },
      userId,
    );
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    void logAudit({ actorUserId: userId, action: 'field.create', entity: 'field', entityId: result.parameter?.id, summary: `Создано поле «${label}»` });
    return NextResponse.json({ parameter: result.parameter });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось создать поле' }, { status: 500 });
  }
}
