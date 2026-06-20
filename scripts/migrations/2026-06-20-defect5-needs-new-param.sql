-- Дефект 5 (ЛС/регистрация): 6 правил ссылались на отсутствующие в форме поля
-- (param-sterile, param-aseptic, param-new-excipient, param-nonclinical-studies,
--  param-license-or-patent-active, param-cis-manufacturer) и имели
-- applicability='needs_new_param' → документы не могли срабатывать.
--
-- Поля добавлены в форму (seed-additional-parameters.json + seed-ls-base-fields.json
-- + parameter-groups.ts). После этого условия (condition_json) вычисляются корректно,
-- поэтому переводим эти правила в conditional_required (корректный severity=critical).
--
-- Применено на ndda_reference_kb:55440. Бэкап: backups/db-before-ls-edits-20260620_223507/

UPDATE document_requirement_rules
SET applicability = 'conditional_required',
    updated_at = now(),
    updated_by_user_id = 'claude-fix-defect5'
WHERE active
  AND scope_object_type = 'LS'
  AND scope_procedure = 'registration'
  AND applicability = 'needs_new_param';
-- ожидается: UPDATE 6
