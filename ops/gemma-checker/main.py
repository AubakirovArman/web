from __future__ import annotations

import json
import os
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="NDDA Gemma Checker service", version="0.1.0")

RUNTIME_ROOT = Path(os.environ.get("GEMMA_CHECKER_RUNTIME_DIR", "/mnt/models/NDDA_AI/8040/web/.runtime/gemma-checker"))
JOBS_DIR = RUNTIME_ROOT / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

Status = Literal["passed", "failed", "uncertain", "not_applicable", "skipped"]


def log_event(event: str, payload: Dict[str, Any]) -> None:
    print(f"[gemma-checker:{event}] {json.dumps(payload, ensure_ascii=False)}", flush=True)


class Requirement(BaseModel):
    id: str
    requirementText: str
    sourcePoint: Optional[str] = None
    criticality: Optional[str] = None
    applicabilityCondition: Optional[str] = None
    quote: Optional[str] = None
    checkerMode: Optional[str] = None
    checkTarget: List[str] = Field(default_factory=list)
    linkedApplicationFields: List[str] = Field(default_factory=list)
    missingApplicationFields: List[str] = Field(default_factory=list)
    relatedDocumentCodes: List[str] = Field(default_factory=list)
    expectedCheckerInputs: List[str] = Field(default_factory=list)
    applicabilityGateRequired: bool = False
    aggregateByDossierSectionCode: bool = False
    decisionLogic: Optional[str] = None


class ApplicationFieldValue(BaseModel):
    id: str
    value: Any = None
    present: bool = False


class TextChunk(BaseModel):
    id: str
    text: str
    sourceLabel: Optional[str] = None


class ImagePage(BaseModel):
    id: str
    imageBase64: str
    imageMime: str = "image/png"
    sourceLabel: Optional[str] = None


class CheckRequest(BaseModel):
    applicationId: str = ""
    bundleKey: str = ""
    dossierSectionCode: str = ""
    documentTypeId: str = ""
    documentTypeName: str = ""
    applicationFieldValues: List[ApplicationFieldValue] = Field(default_factory=list)
    requirements: List[Requirement] = Field(default_factory=list)
    textChunks: List[TextChunk] = Field(default_factory=list)
    imagePages: List[ImagePage] = Field(default_factory=list)
    maxRequirementsPerCall: int = 12
    maxTokens: int = 3072
    timeoutSeconds: int = 120


def now() -> float:
    return time.time()


def safe(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in (value or "unknown"))[:180] or "unknown"


def job_path(job_id: str) -> Path:
    return JOBS_DIR / f"{safe(job_id)}.json"


def write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def read_job(job_id: str) -> Dict[str, Any]:
    path = job_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    return json.loads(path.read_text(encoding="utf-8"))


def clean_json(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start:end + 1]
    return text


def build_prompt(req: CheckRequest, requirements: List[Requirement]) -> str:
    reqs = []
    for idx, item in enumerate(requirements, 1):
        reqs.append("\n".join(part for part in [
            f"{idx}. id={item.id}",
            f"Пункт: {item.sourcePoint or 'не указан'}",
            f"Требование: {item.requirementText}",
            f"Режим проверки: {item.checkerMode}" if item.checkerMode else "",
            f"Куда смотреть: {', '.join(item.checkTarget)}" if item.checkTarget else "",
            f"Связанные поля заявления: {', '.join(item.linkedApplicationFields)}" if item.linkedApplicationFields else "",
            f"Недостающие поля заявления: {', '.join(item.missingApplicationFields)}" if item.missingApplicationFields else "",
            f"Связанные разделы досье: {', '.join(item.relatedDocumentCodes)}" if item.relatedDocumentCodes else "",
            "Сначала проверь применимость требования." if item.applicabilityGateRequired else "",
            "Результат можно подтверждать совокупностью файлов по коду раздела." if item.aggregateByDossierSectionCode else "",
            f"Логика проверки: {item.decisionLogic}" if item.decisionLogic else "",
            f"Условие применимости: {item.applicabilityCondition}" if item.applicabilityCondition else "",
            f"Источник/критерий: {item.quote}" if item.quote else "",
        ] if part))
    field_lines = []
    for field in req.applicationFieldValues:
        value = json.dumps(field.value, ensure_ascii=False) if isinstance(field.value, (dict, list)) else str(field.value or "")
        field_lines.append(f"- {field.id}: {'заполнено' if field.present else 'не заполнено'}; значение: {value[:1000]}")
    return "\n".join([
        f"Проверь пакет документов раздела {req.dossierSectionCode or req.bundleKey} — {req.documentTypeName or req.documentTypeId}.",
        "Оцени только по переданному тексту/изображениям. Не выдумывай факты.",
        "Требование считается выполненным, если оно явно подтверждено хотя бы в одном файле/чанке/странице пакета или совокупностью материалов пакета.",
        "Если требование ссылается на поля заявления, используй блок 'Поля заявления' как равноправный источник данных.",
        "Если требование ссылается на связанные разделы досье, учитывай все переданные файлы пакета и их подписи.",
        "ВАЖНО про условные требования: если требование начинается с условия («Если…», «При наличии…», «Для … препаратов…», «В случае если…», «При перерегистрации…») и это условие по тексту/типу препарата НЕ выполняется или неприменимо — верни not_applicable, НЕ failed.",
        "ВАЖНО про сверки со смежными разделами: если требование — сверка со связанным разделом досье (в 'Куда смотреть' есть related_documents или указаны 'Связанные разделы досье'), а текст этого связанного раздела в пакет НЕ передан — верни uncertain с комментарием «нужен смежный раздел <код>», НЕ failed. Отсутствие соседнего документа для сверки не является дефектом проверяемого документа.",
        "Если для воспроизведённого (generic) препарата или фармакопейной/хорошо изученной субстанции требование запрашивает данные, заменяемые ссылкой на фармакопею/CEP/референтный препарат, и такая ссылка есть — считай выполненным.",
        "ВАЖНО про каскад отсутствующего документа: если сам проверяемый/основной документ раздела не передан в пакет (например, требуется CPP или регистрационное удостоверение, а их нет), то зависимые сверки по нему верни uncertain с комментарием «основной документ отсутствует», НЕ failed. Факт отсутствия обязательного документа фиксируется отдельной проверкой наличия — не дублируй его как несколько failed.",
        "Если условие явно неприменимо, верни not_applicable. Если данных недостаточно, нужен непереданный смежный раздел или отсутствует сам проверяемый документ, верни uncertain. failed ставь ТОЛЬКО когда применимое обязательное требование по фактически представленному документу не подтверждено.",
        "Ответ строго JSON без Markdown:",
        '{"results":[{"id":"...","status":"passed|failed|uncertain|not_applicable","evidence":"короткий фрагмент/страница/файл","comment":"пояснение","confidence":0.0}]}',
        "",
        "Поля заявления:",
        "\n".join(field_lines) if field_lines else "Не переданы.",
        "",
        "Требования:",
        "\n\n".join(reqs),
    ])


def call_vllm(req: CheckRequest, requirements: List[Requirement], text: str, images: List[ImagePage]) -> Dict[str, Any]:
    url = os.environ.get("VLLM_URL")
    api_key = os.environ.get("VLLM_API_KEY")
    model = os.environ.get("VLLM_MODEL")
    if not url or not api_key or not model:
        log_event("vllm-skipped", {"applicationId": req.applicationId, "bundleKey": req.bundleKey, "reason": "VLLM env missing"})
        return {"status": "skipped", "provider": "local-parser", "errors": ["VLLM environment variables are not configured"], "results": []}

    content: Any
    prompt = build_prompt(req, requirements)
    if images:
        content = [{"type": "text", "text": f"{prompt}\n\nТекстовые фрагменты:\n{text}"}]
        for image in images:
            content.append({"type": "image_url", "image_url": {"url": f"data:{image.imageMime};base64,{image.imageBase64}"}})
    else:
        content = f"{prompt}\n\nТекстовые фрагменты:\n{text}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Ты проверяешь фармацевтические документы. Всегда отвечай только валидным JSON."},
            {"role": "user", "content": content},
        ],
        "temperature": 0,
        "max_tokens": req.maxTokens,
    }
    log_event("vllm-start", {
        "applicationId": req.applicationId,
        "bundleKey": req.bundleKey,
        "dossierSectionCode": req.dossierSectionCode,
        "requirements": len(requirements),
        "textChars": len(text),
        "images": len(images),
        "timeoutSeconds": req.timeoutSeconds,
    })
    raw = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=raw, method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(request, timeout=req.timeoutSeconds) as response:
            body = response.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"VLLM HTTP {error.code}: {error.read().decode('utf-8', errors='ignore')[:1000]}") from error
    except Exception as error:
        raise RuntimeError(str(error)) from error

    payload = json.loads(body)
    answer = str(payload.get("choices", [{}])[0].get("message", {}).get("content", ""))
    parsed = json.loads(clean_json(answer))
    log_event("vllm-done", {
        "applicationId": req.applicationId,
        "bundleKey": req.bundleKey,
        "dossierSectionCode": req.dossierSectionCode,
        "requirements": len(requirements),
        "rawChars": len(answer),
        "results": len(parsed.get("results", [])),
    })
    return {"status": "success", "provider": f"vllm:{model}", "raw": answer, "results": parsed.get("results", [])}


def normalize_status(value: Any) -> Status:
    text = str(value or "").lower()
    if text in {"passed", "pass", "yes", "ok", "выполнено", "соответствует"}:
        return "passed"
    if text in {"failed", "fail", "no", "не выполнено", "не соответствует"}:
        return "failed"
    if text in {"not_applicable", "not applicable", "na", "n/a", "не применимо"}:
        return "not_applicable"
    if text in {"skipped", "skip", "пропущено"}:
        return "skipped"
    return "uncertain"


def run_check(req: CheckRequest) -> Dict[str, Any]:
    started = now()
    log_event("check-start", {
        "applicationId": req.applicationId,
        "bundleKey": req.bundleKey,
        "dossierSectionCode": req.dossierSectionCode,
        "documentTypeId": req.documentTypeId,
        "requirements": len(req.requirements),
        "textChunks": len(req.textChunks),
        "imagePages": len(req.imagePages),
    })
    all_results = []
    calls = 0
    errors = []
    chunks = req.textChunks or [TextChunk(id="empty", text="", sourceLabel="empty")]

    for chunk in chunks:
        for offset in range(0, len(req.requirements), max(1, req.maxRequirementsPerCall)):
            requirements = req.requirements[offset:offset + req.maxRequirementsPerCall]
            if not requirements:
                continue
            calls += 1
            try:
                response = call_vllm(req, requirements, f"[{chunk.sourceLabel or chunk.id}]\n{chunk.text}", req.imagePages)
                by_id = {str(item.get("id") or ""): item for item in response.get("results", [])}
                for requirement in requirements:
                    item = by_id.get(requirement.id) or {}
                    all_results.append({
                        "requirementId": requirement.id,
                        "status": normalize_status(item.get("status") if item else response.get("status")),
                        "requirementText": requirement.requirementText,
                        "evidence": item.get("evidence") or "",
                        "comment": item.get("comment") or ("" if item else "; ".join(response.get("errors", []))),
                        "confidence": float(item.get("confidence") or 0.5) if item else 0.0,
                        "sourcePoint": requirement.sourcePoint,
                        "provider": response.get("provider"),
                        "chunkId": chunk.id,
                    })
            except Exception as error:
                errors.append(str(error))
                for requirement in requirements:
                    all_results.append({
                        "requirementId": requirement.id,
                        "status": "uncertain",
                        "requirementText": requirement.requirementText,
                        "comment": str(error),
                        "confidence": 0,
                        "sourcePoint": requirement.sourcePoint,
                        "provider": "gemma-checker",
                        "chunkId": chunk.id,
                    })

    status_counts: Dict[str, int] = {}
    for item in all_results:
        status = str(item.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    result = {
        "status": "success" if not errors else "partial",
        "applicationId": req.applicationId,
        "bundleKey": req.bundleKey,
        "dossierSectionCode": req.dossierSectionCode,
        "documentTypeId": req.documentTypeId,
        "calls": calls,
        "requirements": len(req.requirements),
        "results": all_results,
        "errors": errors,
        "durationMs": int((now() - started) * 1000),
    }
    log_event("check-done", {
        "applicationId": req.applicationId,
        "bundleKey": req.bundleKey,
        "dossierSectionCode": req.dossierSectionCode,
        "calls": calls,
        "statusCounts": status_counts,
        "durationMs": result["durationMs"],
        "errors": len(errors),
    })
    return result


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "gemma-checker", "vllmConfigured": bool(os.environ.get("VLLM_URL") and os.environ.get("VLLM_API_KEY") and os.environ.get("VLLM_MODEL"))}


@app.post("/check")
def check(req: CheckRequest) -> Dict[str, Any]:
    return run_check(req)


@app.post("/jobs")
def create_job(req: CheckRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    job_id = f"{req.applicationId or 'app'}-{req.bundleKey or req.dossierSectionCode or uuid.uuid4().hex}-{uuid.uuid4().hex[:8]}"
    record = {"jobId": job_id, "status": "queued", "applicationId": req.applicationId, "bundleKey": req.bundleKey, "dossierSectionCode": req.dossierSectionCode, "createdAt": now(), "updatedAt": now()}
    write_json(job_path(job_id), record)
    background_tasks.add_task(run_job, job_id, req.dict())
    return {"jobId": job_id, "status": "queued"}


def run_job(job_id: str, req_data: Dict[str, Any]) -> None:
    record = read_job(job_id)
    record.update({"status": "running", "startedAt": now(), "updatedAt": now()})
    write_json(job_path(job_id), record)
    try:
        result = run_check(CheckRequest(**req_data))
        record.update({"status": result.get("status", "success"), "finishedAt": now(), "updatedAt": now(), "result": result})
    except Exception as error:
        record.update({"status": "failed", "finishedAt": now(), "updatedAt": now(), "error": str(error)})
    write_json(job_path(job_id), record)


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    return read_job(job_id)


@app.get("/applications/{application_id}/jobs")
def list_application_jobs(application_id: str) -> Dict[str, Any]:
    jobs = []
    for path in JOBS_DIR.glob("*.json"):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if item.get("applicationId") == application_id:
            jobs.append(item)
    jobs.sort(key=lambda item: item.get("createdAt") or 0)
    return {"applicationId": application_id, "count": len(jobs), "jobs": jobs}
