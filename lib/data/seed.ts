import type { ApplicationFormSchema, DocumentType, NPA, ObjectType, Parameter, ProductType, Procedure, Rule } from '@/lib/types';
import { getLsDossierDocumentTypesAsDocumentTypes } from '@/lib/data/ls-document-checks-mapping';
import npasData from '@/lib/data/generated/seed-npas.json';
import baseDocumentTypesData from '@/lib/data/generated/seed-base-document-types.json';
import documentTypeMetadataData from '@/lib/data/generated/seed-document-type-metadata.json';
import baseParametersData from '@/lib/data/generated/seed-base-parameters.json';
import additionalParametersData from '@/lib/data/generated/seed-additional-parameters.json';
import productTypeLabelsData from '@/lib/data/generated/seed-product-type-labels.json';
import lsBaseFieldsData from '@/lib/data/generated/seed-ls-base-fields.json';
import lsProcedureFieldsData from '@/lib/data/generated/seed-ls-procedure-fields.json';
import lsRequiredFieldsData from '@/lib/data/generated/seed-ls-required-fields.json';
import miBaseFieldsData from '@/lib/data/generated/seed-mi-base-fields.json';
import miProcedureFieldsData from '@/lib/data/generated/seed-mi-procedure-fields.json';
import miRequiredFieldsData from '@/lib/data/generated/seed-mi-required-fields.json';
import rulesData from '@/lib/data/generated/seed-rules.json';
import defaultApplicationValuesData from '@/lib/data/generated/seed-default-application-values.json';

export const npas = npasData as NPA[];

const baseDocumentTypes = baseDocumentTypesData as DocumentType[];
const documentTypeMetadata = documentTypeMetadataData as Record<string, Partial<DocumentType>>;

const legacyDocumentTypes: DocumentType[] = baseDocumentTypes.map((doc) => ({
  ...doc,
  ...documentTypeMetadata[doc.id],
  importedRequirements: [
    ...(documentTypeMetadata[doc.id]?.importedRequirements || []),
    ...(doc.importedRequirements || []),
  ],
}));

export const documentTypes: DocumentType[] = [
  ...legacyDocumentTypes,
  ...getLsDossierDocumentTypesAsDocumentTypes(),
];

const baseParameters = baseParametersData as Parameter[];
const additionalParameters = additionalParametersData as Parameter[];

export const parameters: Parameter[] = [...baseParameters, ...additionalParameters].map((param) => ({
  ...param,
  options: param.options?.map((option) => ({ ...option, label: option.label || option.value })),
}));

export const productTypeLabels = productTypeLabelsData as Record<ProductType, string>;

const lsBaseFields = lsBaseFieldsData as string[];
const lsProcedureFields = lsProcedureFieldsData as Record<Procedure, string[]>;
const lsRequiredFields = lsRequiredFieldsData as Record<Procedure, string[]>;
const miBaseFields = miBaseFieldsData as string[];
const miProcedureFields = miProcedureFieldsData as Record<Procedure, string[]>;
const miRequiredFields = miRequiredFieldsData as Record<Procedure, string[]>;

const lsProfile: ApplicationFormSchema['LS'] = {
  baseFields: lsBaseFields,
  procedureFields: lsProcedureFields,
  requiredFields: lsRequiredFields,
};

const miProfile: ApplicationFormSchema['MI'] = {
  baseFields: miBaseFields,
  procedureFields: miProcedureFields,
  requiredFields: miRequiredFields,
};

export const applicationFormProfiles: ApplicationFormSchema = {
  LS: lsProfile,
  MI: miProfile,
};

export function getVisibleParameterIds(
  objectType: ObjectType,
  procedure: Procedure,
  _values?: Record<string, unknown>,
): string[] {
  const profile = applicationFormProfiles[objectType];
  return Array.from(
    new Set([
      ...profile.baseFields,
      ...(profile.procedureFields[procedure] || []),
    ]),
  );
}

export function getRequiredParameterIds(
  objectType: ObjectType,
  procedure: Procedure,
): string[] {
  const profile = applicationFormProfiles[objectType];
  return profile.requiredFields[procedure] || [];
}

export function getParameterLabelById(paramId: string): string {
  return parameters.find((param) => param.id === paramId)?.label || paramId;
}

export const rules = rulesData as Rule[];

export const defaultApplicationValues = defaultApplicationValuesData as Record<string, string>;
