import type { UploadedFile } from '@/lib/types';
import { parameters } from '@/lib/data/seed';
import type { CheckRunContext } from '@/lib/checks/engine-context';
import {
  createFinding,
  daysUntil,
  extract,
  findFile,
  getApplicationDosage,
  getApplicationInn,
  getApplicationTradeName,
  getDocName,
  getDocType,
  getOptionLabel,
  hasFilledValue,
  isExpired,
  isKazakhstanManufacturer,
  normalize,
  normalizeLoose,
  parseDate,
  parseJsonValue,
  stringValue,
  unitLabel,
} from '@/lib/checks/engine-utils';
import {
  checkBlackTriangle,
  checkRequiredSections,
  fileEvidenceText,
  getModule3EvidenceFiles,
  hasModule3Evidence,
  INSTRUCTION_REQUIRED_SECTIONS,
  SPC_REQUIRED_SECTIONS,
} from '@/lib/checks/engine-file-helpers';

export function runLsManufacturingChecks(context: CheckRunContext) {
  const { app, findings, values } = context;
  // 3. GMP validity and address
  const gmp = findFile(app, 'doc-gmp');
  if (gmp) {
    const gmpAddress = extract(gmp, 'address');
    const appAddress = values['param-manufacturer-address'] as string;
    if (gmpAddress && appAddress && normalize(gmpAddress) !== normalize(appAddress)) {
      findings.push(
        createFinding(
          'serious',
          'GMP / производство',
          'Адрес производственной площадки в GMP отличается от заявления',
          `В заявлении указан адрес: «${appAddress}». В GMP-сертификате: «${gmpAddress}».`,
          [getDocName('doc-gmp'), 'Заявление'],
          'Проверьте соответствие GMP-сертификата заявленной площадке.',
          [
            { source: 'Заявление', text: appAddress },
            { source: getDocName('doc-gmp'), text: gmpAddress },
          ],
          'Приказ ҚР ДСМ-10, Приложение 2, IА1; Решение Совета ЕЭК № 77'
        )
      );
    }
    const gmpValid = extract(gmp, 'validUntil');
    if (gmpValid && isExpired(gmpValid)) {
      findings.push({
        ...createFinding(
          'critical',
          'GMP / производство',
          'GMP-сертификат просрочен',
          `Срок действия GMP-сертификата: ${gmpValid}.`,
          [getDocName('doc-gmp')],
          'Предоставьте действующий GMP-сертификат или актуальную выписку из реестра.',
          [{ source: getDocName('doc-gmp'), text: gmpValid! }],
          'Решение Совета ЕЭК № 77'
        ),
        checkerId: 'document_expiry_check',
        confidence: 0.95,
      });
    }
    const gmpValidDays = gmpValid ? daysUntil(gmpValid) : null;
    if (gmpValidDays !== null && gmpValidDays >= 0 && gmpValidDays <= 180) {
      findings.push({
        ...createFinding(
          'warning',
          'GMP / производство',
          'Срок действия GMP-сертификата истекает в ближайшие 6 месяцев',
          `GMP-сертификат действителен до ${gmpValid} (осталось ${gmpValidDays} дн.).`,
          [getDocName('doc-gmp')],
          'Убедитесь, что к моменту рассмотрения заявки сертификат будет действителен, или предоставьте новый.',
          [{ source: getDocName('doc-gmp'), text: gmpValid! }],
          'Решение Совета ЕЭК № 77'
        ),
        checkerId: 'document_expiry_check',
        confidence: 0.95,
      });
    }
    const gmpManufacturer = extract(gmp, 'manufacturer');
    const appManufacturer = values['param-manufacturer'] as string;
    if (gmpManufacturer && appManufacturer && normalize(gmpManufacturer) !== normalize(appManufacturer)) {
      findings.push(
        createFinding(
          'serious',
          'GMP / производство',
          'Производитель в GMP-сертификате отличается от заявления',
          `В заявлении указан производитель: «${appManufacturer}». В GMP-сертификате: «${gmpManufacturer}».`,
          [getDocName('doc-gmp'), 'Заявление'],
          'Проверьте, что GMP-сертификат выдан для заявленного производителя.',
          [
            { source: 'Заявление', text: appManufacturer },
            { source: getDocName('doc-gmp'), text: gmpManufacturer },
          ],
          'Решение Совета ЕЭК № 77'
        )
      );
    }
    const gmpScope = extract(gmp, 'scope');
    const appDosageForm = values['param-dosage-form'] as string;
    const dosageFormParam = parameters.find((p) => p.id === 'param-dosage-form');
    const appDosageFormLabel = dosageFormParam?.options?.find((o) => o.value === appDosageForm)?.label || appDosageForm;
    if (gmpScope && appDosageForm && !normalize(gmpScope).includes(normalize(appDosageForm)) && !normalize(gmpScope).includes(normalize(appDosageFormLabel))) {
      findings.push(
        createFinding(
          'warning',
          'GMP / производство',
          'GMP-сертификат может не покрывать заявленную лекарственную форму',
          `В заявлении лекарственная форма: «${appDosageFormLabel}». Область действия GMP: «${gmpScope}».`,
          [getDocName('doc-gmp'), 'Заявление'],
          'Проверьте, что GMP-сертификат покрывает производство заявленной лекарственной формы.',
          [
            { source: 'Заявление', text: appDosageFormLabel },
            { source: getDocName('doc-gmp'), text: gmpScope },
          ],
          'Решение Совета ЕЭК № 77; Приказ ҚР ДСМ-9'
        )
      );
    }
  }

  // 4. CPP validity
  const cpp = findFile(app, 'doc-cpp');
  if (cpp) {
    const cppValid = extract(cpp, 'validUntil');
    if (cppValid && isExpired(cppValid)) {
      findings.push({
        ...createFinding(
          'serious',
          'CPP / регистрация',
          'Сертификат фармацевтического продукта просрочен',
          `Срок действия CPP: ${cppValid}.`,
          [getDocName('doc-cpp')],
          'Предоставьте действующий CPP.',
          [{ source: getDocName('doc-cpp'), text: cppValid }],
          'Решение Совета ЕЭК № 78'
        ),
        checkerId: 'document_expiry_check',
        confidence: 0.95,
      });
    }
  }

}
