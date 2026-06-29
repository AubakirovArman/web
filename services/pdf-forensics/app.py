"""
PDF-форензика: отдельный сервис проверки подлинности PDF.
Эндпоинты: /health, /analyze (полный отчёт), /compare-stamp (сравнение печати с эталоном).
Не зависит от Next; вся тяжёлая работа здесь.
"""
import io
import os
import re
import base64
import datetime
from typing import Any, Optional

import fitz  # PyMuPDF
import numpy as np
import cv2
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None

app = FastAPI(title="NDDA PDF Forensics", version="1.0")

# ---------------------------------------------------------------------------
# Конфиг Gemma (читаем из web/.env.local)
# ---------------------------------------------------------------------------
def _load_env() -> dict:
    env = {}
    path = os.environ.get("NDDA_ENV_FILE", "/mnt/models/NDDA_AI/8040/web/.env.local")
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return env

_ENV = _load_env()
VLLM_URL = os.environ.get("VLLM_URL") or _ENV.get("VLLM_URL", "")
VLLM_MODEL = os.environ.get("VLLM_MODEL") or _ENV.get("VLLM_MODEL", "")
VLLM_API_KEY = os.environ.get("VLLM_API_KEY") or _ENV.get("VLLM_API_KEY", "")

# Классификация ПО-создателя
NATIVE_TOOLS = ["microsoft word", "libreoffice", "openoffice", "powerpoint", "excel", "google", "pages", "latex", "tex", "wkhtmltopdf", "chromium", "skia"]
REPROCESS_TOOLS = ["ilovepdf", "smallpdf", "pdf24", "soda pdf", "foxit", "nitro", "pdfsharp", "itext", "tcpdf", "fpdf", "ghostscript", "cairo", "quartz pdfcontext", "mac os x"]
SCAN_TOOLS = ["scan", "scanner", "canoscan", "epson", "hp ", "kyocera", "xerox", "abbyy", "finereader", "camscanner", "adobe scan", "naps2"]
EDIT_TOOLS = ["acrobat", "pdf editor", "pdfedit", "master pdf", "pdf-xchange", "inkscape", "gimp", "photoshop"]


# ---------------------------------------------------------------------------
# Утилиты
# ---------------------------------------------------------------------------
def parse_pdf_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    m = re.match(r"D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?", str(value))
    if not m:
        return str(value)
    y, mo, d, h, mi, s = (m.group(i) or z for i, z in zip(range(1, 7), ["", "01", "01", "00", "00", "00"]))
    try:
        return f"{y}-{mo or '01'}-{d or '01'} {h or '00'}:{mi or '00'}:{s or '00'}"
    except Exception:
        return str(value)


def classify_tool(text: str) -> str:
    t = (text or "").lower()
    if not t:
        return "не указано"
    for kw in SCAN_TOOLS:
        if kw in t:
            return "скан/распознавание"
    for kw in NATIVE_TOOLS:
        if kw in t:
            return "родное создание"
    for kw in EDIT_TOOLS:
        if kw in t:
            return "редактор PDF"
    for kw in REPROCESS_TOOLS:
        if kw in t:
            return "пересохранение/конвертер"
    return "иное"


def gemma_vision(prompt: str, images_png: list[bytes], max_tokens: int = 700) -> Optional[str]:
    if not VLLM_URL or not VLLM_API_KEY:
        return None
    content: list[dict] = [{"type": "text", "text": prompt}]
    for png in images_png[:5]:
        b64 = base64.b64encode(png).decode()
        content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
    payload = {"model": VLLM_MODEL, "max_tokens": max_tokens, "temperature": 0.1,
               "messages": [{"role": "user", "content": content}]}
    try:
        with httpx.Client(timeout=120) as client:
            r = client.post(VLLM_URL, headers={"Authorization": f"Bearer {VLLM_API_KEY}"}, json=payload)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return f"[Gemma недоступна: {str(e)[:120]}]"


# ---------------------------------------------------------------------------
# Анализ
# ---------------------------------------------------------------------------
def analyze_metadata(doc: fitz.Document, raw: bytes) -> dict:
    md = doc.metadata or {}
    creation = parse_pdf_date(md.get("creationDate"))
    modification = parse_pdf_date(md.get("modDate"))
    anomalies = []
    try:
        if md.get("creationDate") and md.get("modDate"):
            c = re.sub(r"\D", "", md["creationDate"])[:14]
            m = re.sub(r"\D", "", md["modDate"])[:14]
            if c and m and m < c:
                anomalies.append("Дата изменения РАНЬШЕ даты создания — признак подмены дат")
            if c and m and m != c:
                anomalies.append("Документ изменялся после создания (даты создания и изменения различаются)")
    except Exception:
        pass

    # XMP
    xmp = {}
    history = []
    try:
        xml = doc.xref_xml_metadata()
        if xml:
            for tag in ["xmp:CreatorTool", "xmp:CreateDate", "xmp:ModifyDate", "xmp:MetadataDate",
                        "pdf:Producer", "dc:creator", "xmpMM:DocumentID", "xmpMM:InstanceID"]:
                m = re.search(rf"<{tag}>(.*?)</{tag}>", xml, re.S) or re.search(rf'{tag}="(.*?)"', xml)
                if m:
                    xmp[tag] = m.group(1).strip()[:200]
            # история правок (xmpMM:History)
            for ev in re.findall(r"stEvt:(softwareAgent|when|action)>?=?\"?(.*?)[\"<]", xml)[:30]:
                history.append(f"{ev[0]}: {ev[1]}")
    except Exception:
        pass

    return {
        "info": {
            "title": md.get("title") or "",
            "author": md.get("author") or "",
            "subject": md.get("subject") or "",
            "creator": md.get("creator") or "",
            "producer": md.get("producer") or "",
        },
        "creator_class": classify_tool(md.get("creator", "")),
        "producer_class": classify_tool(md.get("producer", "")),
        "creation_date": creation,
        "modification_date": modification,
        "xmp": xmp,
        "history": history[:20],
        "anomalies": anomalies,
    }


def analyze_structure(raw: bytes) -> dict:
    eof = raw.count(b"%%EOF")
    startxref = raw.count(b"startxref")
    linearized = b"/Linearized" in raw[:4096]
    encrypted = b"/Encrypt" in raw
    incremental = max(0, eof - 1)
    return {
        "eof_count": eof,
        "startxref_count": startxref,
        "incremental_updates": incremental,
        "modified_after_creation": incremental > 0,
        "linearized": linearized,
        "encrypted": encrypted,
        "pdf_version": (re.match(rb"%PDF-(\d\.\d)", raw[:16]).group(1).decode() if re.match(rb"%PDF-(\d\.\d)", raw[:16]) else "?"),
    }


def analyze_signatures(doc: fitz.Document, raw: bytes) -> dict:
    sigs = []
    has_byterange = b"/ByteRange" in raw
    try:
        for page in doc:
            for w in (page.widgets() or []):
                if getattr(w, "field_type", None) == fitz.PDF_WIDGET_TYPE_SIGNATURE or "Sig" in str(getattr(w, "field_type_string", "")):
                    sigs.append({"page": page.number + 1, "field": getattr(w, "field_name", "") or "подпись"})
    except Exception:
        pass
    # извлечь имя подписанта из PKCS7 (грубо — по сертификату в потоке)
    signer = None
    try:
        m = re.search(rb"/Contents\s*<([0-9A-Fa-f]+)>", raw)
        if m:
            der = bytes.fromhex(m.group(1).decode())
            from asn1crypto import cms  # type: ignore
            ci = cms.ContentInfo.load(der)
            signed = ci["content"]
            for cert in signed["certificates"]:
                subj = cert.chosen["tbs_certificate"]["subject"].native
                signer = subj.get("common_name") or subj.get("organization_name")
                if signer:
                    break
    except Exception:
        signer = None
    digital = has_byterange and (len(sigs) > 0 or signer is not None or b"adbe.pkcs7" in raw)
    return {
        "has_digital_signature": bool(digital),
        "signature_fields": sigs,
        "signer": signer,
        "note": ("Найдена криптографическая ЭЦП" if digital
                 else "Криптографическая ЭЦП не найдена — любые подписи/печати в документе являются изображениями, а не электронной подписью"),
    }


def analyze_pages_images_fonts(doc: fitz.Document) -> dict:
    pages, images, fonts = [], [], []
    scanned_pages = 0
    font_names = set()
    for page in doc:
        rect = page.rect
        text = page.get_text("text") or ""
        imgs = page.get_images(full=True) or []
        # скан: страница почти целиком покрыта одним изображением + мало текста
        full_page_img = False
        for img in imgs:
            try:
                xref = img[0]
                rects = page.get_image_rects(xref)
                for ir in rects:
                    cover = (ir.width * ir.height) / (rect.width * rect.height + 1e-6)
                    if cover > 0.7:
                        full_page_img = True
            except Exception:
                pass
        is_scanned = full_page_img and len(text.strip()) < 50
        if is_scanned:
            scanned_pages += 1
        pages.append({
            "index": page.number + 1,
            "text_len": len(text.strip()),
            "image_count": len(imgs),
            "is_scanned": is_scanned,
            "full_page_image": full_page_img,
        })
        # изображения с эвристикой
        for img in imgs:
            try:
                xref = img[0]
                w, h = img[2], img[3]
                cs = img[5] or ""
                filt = img[8] or ""
                smask = img[1]
                rects = page.get_image_rects(xref)
                dpi = None
                reasons = []
                if rects:
                    ir = rects[0]
                    if ir.width > 1 and ir.height > 1:
                        dpi_x = w / (ir.width / 72.0)
                        dpi_y = h / (ir.height / 72.0)
                        dpi = round((dpi_x + dpi_y) / 2)
                cover = 0.0
                if rects:
                    ir = rects[0]
                    cover = (ir.width * ir.height) / (rect.width * rect.height + 1e-6)
                if smask:
                    reasons.append("есть альфа-канал (прозрачность) — типично для вставленной печати/подписи")
                if "DCT" in str(filt) and cover < 0.4 and smask:
                    reasons.append("JPEG-картинка с прозрачностью поверх страницы")
                if dpi and dpi < 120 and cover < 0.3:
                    reasons.append(f"низкое DPI ({dpi}) маленькой вставки")
                images.append({
                    "page": page.number + 1, "xref": xref, "width": w, "height": h,
                    "colorspace": str(cs), "format": str(filt), "has_alpha": bool(smask),
                    "dpi": dpi, "coverage": round(cover, 3), "suspicious": len(reasons) > 0,
                    "reasons": reasons,
                })
            except Exception:
                pass
        # шрифты
        try:
            for f in page.get_fonts(full=True):
                name = f[3]
                embedded = bool(f[1])  # ext present → embedded
                if name not in font_names:
                    font_names.add(name)
                    fonts.append({"name": name, "type": f[2], "embedded": embedded})
        except Exception:
            pass
    return {
        "pages": pages,
        "images": images,
        "fonts": fonts,
        "scanned": {
            "is_scanned": scanned_pages > 0 and scanned_pages >= len(pages) * 0.6,
            "scanned_pages": scanned_pages,
            "total_pages": len(pages),
            "non_embedded_fonts": [f["name"] for f in fonts if not f["embedded"]],
        },
    }


def build_risk(meta: dict, struct: dict, sig: dict, pif: dict) -> dict:
    signals = []

    def add(code, label, severity, detail):
        signals.append({"code": code, "label": label, "severity": severity, "detail": detail})

    for a in meta.get("anomalies", []):
        add("date_anomaly", "Аномалия дат", "high", a)
    if struct.get("incremental_updates", 0) > 0:
        add("incremental", "Инкрементальные правки",
            "high" if struct["incremental_updates"] >= 2 else "medium",
            f"Документ дописывался после создания ({struct['incremental_updates']} доп. сохранений в файле)")
    if meta.get("producer_class") == "пересохранение/конвертер":
        add("reprocessed", "Пересохранение", "medium",
            f"Producer = «{meta['info']['producer']}» — документ прогнали через конвертер/онлайн-сервис")
    if meta.get("producer_class") == "редактор PDF" or meta.get("creator_class") == "редактор PDF":
        add("pdf_editor", "Создан/правлен в PDF-редакторе", "medium",
            f"Creator/Producer указывает на редактор PDF — возможны ручные правки содержимого")
    if pif["scanned"]["is_scanned"]:
        add("scanned", "Скан-документ", "low",
            "Документ — скан (нет текстового слоя). ЭЦП невозможна; печати/подписи — часть растра")
    susp = [i for i in pif["images"] if i["suspicious"]]
    if susp:
        add("inserted_images", "Подозрительные вставки", "high",
            f"Найдено вставок с признаками наложения: {len(susp)} (прозрачность/низкое DPI/JPEG поверх страницы)")
    if not sig["has_digital_signature"]:
        add("no_esign", "Нет ЭЦП", "medium", sig["note"])
    else:
        add("esign", "Есть ЭЦП", "low", f"Криптографическая подпись присутствует (подписант: {sig.get('signer') or 'не извлечён'})")
    if pif["scanned"]["non_embedded_fonts"]:
        add("non_embedded_fonts", "Невстроенные шрифты", "low",
            f"Шрифты без встраивания: {', '.join(pif['scanned']['non_embedded_fonts'][:5])}")

    weight = {"critical": 40, "high": 25, "medium": 12, "low": 4}
    score = sum(weight.get(s["severity"], 0) for s in signals if s["code"] not in ("esign",))
    score = min(100, score)
    level = "высокий" if score >= 50 else "средний" if score >= 20 else "низкий"
    return {
        "signals": signals,
        "score": score,
        "level": level,
        "summary": f"Риск манипуляций: {level} ({score}/100). Сигналов: {len(signals)}.",
    }


@app.get("/health")
def health():
    return {"ok": True, "service": "pdf-forensics", "gemma": bool(VLLM_URL and VLLM_API_KEY), "model": VLLM_MODEL}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), use_gemma: bool = Form(True)):
    raw = await file.read()
    if not raw[:5].startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Файл не является PDF")
    try:
        doc = fitz.open(stream=raw, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось открыть PDF: {e}")

    result: dict[str, Any] = {
        "filename": file.filename,
        "size_bytes": len(raw),
        "page_count": doc.page_count,
        "encrypted": doc.is_encrypted,
    }
    result["metadata"] = analyze_metadata(doc, raw)
    result["structure"] = analyze_structure(raw)
    result["signatures"] = analyze_signatures(doc, raw)
    result.update(analyze_pages_images_fonts(doc))
    result["risk"] = build_risk(result["metadata"], result["structure"], result["signatures"], result)

    # Мультимодальная оценка первой/проблемных страниц через Gemma (опц.)
    if use_gemma and VLLM_URL:
        try:
            pages_to_show = sorted({0} | {i["page"] - 1 for i in result["images"] if i["suspicious"]})[:3]
            imgs = []
            for pno in pages_to_show:
                pix = doc[pno].get_pixmap(dpi=110)
                imgs.append(pix.tobytes("png"))
            prompt = ("Ты — эксперт по подлинности документов. Осмотри страницы PDF. "
                      "Есть ли признаки подделки: неестественно вставленные печати/подписи (резкие края, "
                      "несовпадение фона, прозрачные прямоугольники), несоответствие шрифтов, следы редактирования? "
                      "Опиши найденные печати и подписи и оцени, выглядят ли они вставленными. Кратко, по-русски.")
            result["gemma_visual"] = gemma_vision(prompt, imgs)
        except Exception as e:
            result["gemma_visual"] = f"[ошибка визуального анализа: {str(e)[:120]}]"

    doc.close()
    return JSONResponse(result)


def _orb_similarity(ref_gray: np.ndarray, scene_gray: np.ndarray) -> float:
    try:
        orb = cv2.ORB_create(nfeatures=1500)
        k1, d1 = orb.detectAndCompute(ref_gray, None)
        k2, d2 = orb.detectAndCompute(scene_gray, None)
        if d1 is None or d2 is None or len(k1) < 8:
            return 0.0
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(d1, d2)
        good = [m for m in matches if m.distance < 64]
        return round(len(good) / max(8, len(k1)), 3)
    except Exception:
        return 0.0


@app.post("/compare-stamp")
async def compare_stamp(file: UploadFile = File(...), stamp: UploadFile = File(...), use_gemma: bool = Form(True)):
    raw = await file.read()
    stamp_bytes = await stamp.read()
    if not raw[:5].startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Файл не является PDF")
    try:
        doc = fitz.open(stream=raw, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось открыть PDF: {e}")

    ref_arr = cv2.imdecode(np.frombuffer(stamp_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    per_page = []
    page_pngs = []
    for page in doc:
        pix = page.get_pixmap(dpi=150)
        png = pix.tobytes("png")
        page_pngs.append(png)
        scene = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
        sim = _orb_similarity(ref_arr, scene) if ref_arr is not None else 0.0
        per_page.append({"page": page.number + 1, "cv_similarity": sim})

    best = max(per_page, key=lambda x: x["cv_similarity"]) if per_page else None
    cv_verdict = "не найдено совпадений" if not best or best["cv_similarity"] < 0.08 else (
        "высокое сходство" if best["cv_similarity"] >= 0.2 else "частичное сходство")

    gemma_verdict = None
    if use_gemma and VLLM_URL:
        show = [stamp_bytes] + page_pngs[:4]
        prompt = ("Первое изображение — ЭТАЛОН печати. Остальные — страницы документа. "
                  "Найди печать на страницах и сравни с эталоном: это та же печать? "
                  "Совпадают ли текст, форма, реквизиты? Выглядит ли печать на документе настоящей (с наложением "
                  "на текст, неровностями) или вставленной картинкой? Дай вывод и процент уверенности. По-русски, кратко.")
        gemma_verdict = gemma_vision(prompt, show, max_tokens=600)

    doc.close()
    return JSONResponse({
        "filename": file.filename,
        "per_page": per_page,
        "best_match": best,
        "cv_verdict": cv_verdict,
        "gemma_verdict": gemma_verdict,
    })
