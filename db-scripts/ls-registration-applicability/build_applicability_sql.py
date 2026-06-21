# -*- coding: utf-8 -*-
"""Генерирует SQL для проставления condition_json (применимость по параметрам)
на правила LS/registration. Источник истины — матрица ниже (по коду ОТД).
Меняем ТОЛЬКО логический предикат (ключ 'all'), сохраняя requirement_sources."""
import json

BASE = [{"eq": ["param-object-type", "LS"]}, {"eq": ["param-procedure", "registration"]}]

def isyes(p): return {"any": [{"eq": [p, True]}, {"eq": [p, "yes"]}]}
def inlist(p, vals): return {"in": [p, vals]}

FULL = ["original", "biological", "vaccine", "advanced-therapy", "blood", "radiopharmaceutical"]
BIO  = ["original", "biological", "biosimilar", "vaccine", "advanced-therapy"]
ABRIDGED = ["generic", "hybrid", "biosimilar", "well-established", "herbal", "homeopathic", "orphan"]
GEN_BIOEQ = ["generic", "hybrid", "biosimilar"]

NEVER       = [inlist("param-product-type", ["__none__"])]
preclinical = [{"any": [inlist("param-product-type", FULL), isyes("param-nonclinical-studies")]}]
clinical    = [{"any": [inlist("param-product-type", FULL), isyes("param-clinical-studies")]}]
bioeq       = [{"any": [{"all": [inlist("param-product-type", GEN_BIOEQ), isyes("param-bioequivalence-required")]}, inlist("param-product-type", FULL)]}]
mod5_hdr    = [{"any": [inlist("param-product-type", FULL), isyes("param-clinical-studies"),
                        {"all": [inlist("param-product-type", GEN_BIOEQ), isyes("param-bioequivalence-required")]}]}]
rmp         = [{"any": [isyes("param-biological-flag"), isyes("param-immunobiological-flag"), inlist("param-product-type", BIO)]}]
gmo         = [isyes("param-contains-gmo")]
license     = [{"any": [isyes("param-license-or-patent-active"), {"eq": ["param-product-type", "original"]}]}]
trademark   = [isyes("param-trademark-required")]
abridged    = [inlist("param-product-type", ABRIDGED)]
spc_orig    = [{"eq": ["param-product-type", "original"]}]
cis         = [isyes("param-cis-manufacturer")]
animal      = [isyes("param-human-animal-origin")]
new_exc     = [isyes("param-new-excipient")]
additions_a2= [{"any": [inlist("param-product-type", ["biological", "biosimilar", "vaccine", "advanced-therapy", "blood"]), isyes("param-human-animal-origin")]}]
aseptic_eq  = [{"any": [isyes("param-aseptic"), inlist("param-product-type", BIO)]}]
reref_only  = [{"eq": ["param-procedure", "re-registration"]}]
ALWAYS      = []  # только BASE

# код -> доп.предикат (помимо BASE)
MATRIX = {
    # --- Модуль 1 ---
    "1.1": ALWAYS, "1.2": ALWAYS, "1.2.1": ALWAYS,
    "1.2.2": license, "1.2.3": NEVER, "1.2.4": trademark,
    "1.2.5": abridged, "1.2.6": abridged,
    "1.3": ALWAYS, "1.3.1": spc_orig, "1.3.2": cis, "1.3.3": ALWAYS,
    "1.3.4": ALWAYS, "1.3.5": ALWAYS, "1.3.6": abridged,
    "1.4": NEVER, "1.4.1": NEVER, "1.4.2": NEVER, "1.4.3": NEVER,
    "1.5": gmo, "1.5.1": gmo,
    "1.6": ALWAYS, "1.6.1": ALWAYS, "1.6.2": reref_only, "1.6.3": rmp, "1.6.4": ALWAYS,
    # --- Модуль 2 ---
    "2.1": ALWAYS, "2.2": ALWAYS, "2.3": ALWAYS,
    "2.3.A": NEVER, "2.3.A.1": aseptic_eq, "2.3.A.2": additions_a2, "2.3.A.3": new_exc,
    "2.3.P": ALWAYS, "2.3.P.1": ALWAYS, "2.3.P.2": ALWAYS, "2.3.P.3": ALWAYS,
    "2.3.P.4": ALWAYS, "2.3.P.5": ALWAYS, "2.3.P.6": NEVER, "2.3.P.7": ALWAYS, "2.3.P.8": ALWAYS,
    "2.3.R": NEVER,
    "2.3.S": ALWAYS, "2.3.S.1": ALWAYS, "2.3.S.2": ALWAYS, "2.3.S.3": ALWAYS,
    "2.3.S.4": ALWAYS, "2.3.S.5": NEVER, "2.3.S.6": ALWAYS, "2.3.S.7": ALWAYS,
    "2.4": preclinical, "2.5": clinical,
    "2.6": preclinical, "2.6.1": preclinical, "2.6.2": preclinical, "2.6.3": preclinical,
    "2.6.4": preclinical, "2.6.5": preclinical, "2.6.6": preclinical,
    "2.7": clinical, "2.7.1": bioeq, "2.7.2": clinical, "2.7.3": clinical,
    "2.7.4": clinical, "2.7.5": NEVER, "2.7.6": clinical,
    # --- Модуль 3 (качество) ---
    "3.1": ALWAYS, "3.2": ALWAYS,
    "3.2.A": NEVER, "3.2.A.1": aseptic_eq, "3.2.A.2": additions_a2, "3.2.A.3": new_exc,
    "3.2.P.1": ALWAYS, "3.2.P.2": ALWAYS, "3.2.P.2.1": ALWAYS, "3.2.P.2.1.1": ALWAYS,
    "3.2.P.2.1.2": ALWAYS, "3.2.P.2.2": ALWAYS, "3.2.P.2.2.1": ALWAYS, "3.2.P.2.2.2": ALWAYS,
    "3.2.P.2.2.3": ALWAYS, "3.2.P.2.3": ALWAYS, "3.2.P.2.4": ALWAYS, "3.2.P.2.5": ALWAYS, "3.2.P.2.6": ALWAYS,
    "3.2.P.3": ALWAYS, "3.2.P.3.1": ALWAYS, "3.2.P.3.2": ALWAYS, "3.2.P.3.3": ALWAYS,
    "3.2.P.3.4": ALWAYS, "3.2.P.3.5": ALWAYS,
    "3.2.P.4": ALWAYS, "3.2.P.4.1": ALWAYS, "3.2.P.4.2": ALWAYS, "3.2.P.4.3": ALWAYS,
    "3.2.P.4.4": ALWAYS, "3.2.P.4.5": animal, "3.2.P.4.6": new_exc,
    "3.2.P.5.1": ALWAYS, "3.2.P.5.2": ALWAYS, "3.2.P.5.3": ALWAYS, "3.2.P.5.4": ALWAYS,
    "3.2.P.5.5": ALWAYS, "3.2.P.5.6": ALWAYS,
    "3.2.P.6": NEVER, "3.2.P.7": ALWAYS,
    "3.2.P.8": ALWAYS, "3.2.P.8.1": ALWAYS, "3.2.P.8.2": ALWAYS, "3.2.P.8.3": ALWAYS,
    "3.2.R": NEVER,
    "3.2.S": ALWAYS, "3.2.S.1": ALWAYS, "3.2.S.1.1": ALWAYS, "3.2.S.1.2": ALWAYS, "3.2.S.1.3": ALWAYS,
    "3.2.S.2": ALWAYS, "3.2.S.2.1": ALWAYS, "3.2.S.2.2": ALWAYS, "3.2.S.2.3": ALWAYS,
    "3.2.S.2.4": ALWAYS, "3.2.S.2.5": ALWAYS, "3.2.S.2.6": ALWAYS,
    "3.2.S.3.1": ALWAYS, "3.2.S.3.2": ALWAYS,
    "3.2.S.4.1": ALWAYS, "3.2.S.4.2": ALWAYS, "3.2.S.4.3": ALWAYS, "3.2.S.4.4": ALWAYS, "3.2.S.4.5": ALWAYS,
    "3.2.S.5": NEVER, "3.2.S.6": ALWAYS,
    "3.2.S.7": ALWAYS, "3.2.S.7.1": ALWAYS, "3.2.S.7.2": ALWAYS, "3.2.S.7.3": ALWAYS,
    "3.3": NEVER,
    # --- Модуль 4 (доклиника) ---
    "4.1": preclinical, "4.2": preclinical, "4.2.1": preclinical, "4.2.1.1": preclinical,
    "4.2.1.2": preclinical, "4.2.1.3": preclinical, "4.2.1.4": preclinical, "4.2.2": preclinical,
    "4.2.2.1": preclinical, "4.2.2.2": preclinical, "4.2.2.3": preclinical, "4.2.2.4": preclinical,
    "4.2.2.5": preclinical, "4.2.2.6": preclinical, "4.2.2.7": preclinical, "4.2.3": preclinical,
    "4.2.3.1": preclinical, "4.2.3.2": preclinical, "4.2.3.3": preclinical, "4.2.3.4": preclinical,
    "4.2.3.5": preclinical, "4.2.3.6": preclinical, "4.2.3.7": preclinical, "4.3": NEVER,
    # --- Модуль 5 (клиника) ---
    "5.1": mod5_hdr, "5.2": mod5_hdr, "5.3": mod5_hdr, "5.3.1": bioeq,
    "5.3.2": clinical, "5.3.3": clinical, "5.3.4": clinical, "5.3.5": clinical,
    "5.3.6": clinical, "5.3.7": clinical, "5.4": NEVER,
}

def predicate_all(extra):
    return BASE + extra

def applic(extra):
    return "always_required" if not extra else "conditional_required"

lines = ["BEGIN;"]
for code, extra in MATRIX.items():
    pred = json.dumps(predicate_all(extra), ensure_ascii=False)
    pred_sql = pred.replace("'", "''")
    a = applic(extra)
    lines.append(
        "UPDATE document_requirement_rules SET "
        "condition_json = (coalesce(condition_json,'{}'::jsonb) - 'any' - 'eq' - 'in' - 'not' - 'not_empty' - 'empty' - 'contains' - 'manual') "
        f"|| jsonb_build_object('all', '{pred_sql}'::jsonb), applicability='{a}' "
        f"WHERE active AND scope_object_type='LS' AND scope_procedure='registration' AND doc_code='{code}';"
    )
lines.append("COMMIT;")
open("/tmp/apply_applicability.sql", "w", encoding="utf-8").write("\n".join(lines))
print(f"кодов в матрице: {len(MATRIX)}  -> /tmp/apply_applicability.sql")
