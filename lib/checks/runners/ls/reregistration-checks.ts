import type { UploadedFile } from '@/lib/types';
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

export function runLsReregistrationChecks(context: CheckRunContext) {
  const { app, findings, values, procedure } = context;
  // 21. Re-registration specific checks
  if (procedure === 're-registration') {
    const regCert = findFile(app, 'doc-registration-certificate');
    if (regCert) {
      const certNumber = extract(regCert, 'registrationNumber');
      const appRegNumber = values['param-registration-number'] as string;
      if (appRegNumber && certNumber && normalize(certNumber) !== normalize(appRegNumber)) {
        findings.push(
          createFinding(
            'serious',
            'Перерегистрация',
            'Номер регистрационного удостоверения не совпадает с заявлением',
            `В заявлении указан номер РУ: «${appRegNumber}», в регистрационном удостоверении: «${certNumber}».`,
            [getDocName('doc-registration-certificate'), 'Заявление'],
            'Проверьте, что приложено действующее регистрационное удостоверение на данный препарат.',
            [
              { source: 'Заявление', text: appRegNumber },
              { source: getDocName('doc-registration-certificate'), text: certNumber },
            ],
            'Приказ ҚР ДСМ-10, Приложение 2'
          )
        );
      }
      const certValid = extract(regCert, 'validUntil');
      if (certValid && isExpired(certValid)) {
        findings.push({
          ...createFinding(
            'critical',
            'Перерегистрация',
            'Регистрационное удостоверение просрочено',
            `Срок действия регистрационного удостоверения: ${certValid}.`,
            [getDocName('doc-registration-certificate')],
            'Предоставьте действующее регистрационное удостоверение.',
            [{ source: getDocName('doc-registration-certificate'), text: certValid }],
            'Приказ ҚР ДСМ-10, Приложение 2'
          ),
          checkerId: 'document_expiry_check',
          confidence: 0.95,
        });
      }
      const certTrade = extract(regCert, 'tradeName');
      const appTrade = getApplicationTradeName(values);
      if (certTrade && appTrade && normalize(certTrade) !== normalize(appTrade)) {
        findings.push(
          createFinding(
            'serious',
            'Перерегистрация',
            'Торговое наименование в регистрационном удостоверении отличается от заявления',
            `В заявлении: «${appTrade}». В регистрационном удостоверении: «${certTrade}».`,
            [getDocName('doc-registration-certificate'), 'Заявление'],
            'Приложите регистрационное удостоверение, соответствующее заявленному препарату.',
            [
              { source: 'Заявление', text: appTrade },
              { source: getDocName('doc-registration-certificate'), text: certTrade },
            ],
            'Приказ ҚР ДСМ-10, Приложение 2'
          )
        );
      }
    }

    const postMarketing = findFile(app, 'doc-post-marketing-data');
    if (postMarketing) {
      const reportDate = extract(postMarketing, 'reportDate');
      if (reportDate) {
        const parsed = parseDate(reportDate);
        if (parsed) {
          const years = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365);
          if (years > 5) {
            findings.push(
              createFinding(
                'warning',
                'Перерегистрация',
                'Пострегистрационные данные устарели',
                `Дата пострегистрационного отчёта: ${reportDate} (более 5 лет назад).`,
                [getDocName('doc-post-marketing-data')],
                'Предоставьте актуальные пострегистрационные данные по безопасности и эффективности.',
                [{ source: getDocName('doc-post-marketing-data'), text: reportDate }],
                'Приказ ҚР ДСМ-10, Приложение 2'
              )
            );
          }
        }
      }
    }
  }

}
