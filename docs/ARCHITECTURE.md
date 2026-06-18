# NDDA 8040 architecture notes

## Runtime source of truth

Postgres is the runtime source of truth for applications, LS registration document types, requiredness rules, and document check profiles.

The application must not use generated JSON or local seed data as runtime fallback for LS registration checks. If Postgres is unavailable or missing LS registration rules, the LS registration flow should fail visibly instead of silently falling back.

## Web application process

The 8040 web app must run as one managed service:

- service: `ndda-8040.service`
- service type: user systemd service (`systemctl --user ...`)
- working directory: `/mnt/models/NDDA_AI/8040/web`
- port: `8040`
- required env:
  - `DOCUMENT_PARSER_URL=http://127.0.0.1:8051`
  - `GEMMA_CHECKER_URL=http://127.0.0.1:8052`
  - values from `web/.env.local` for VLLM/Gemma

Manual `npm run start -H 0.0.0.0 -p 8040`, `nohup npm run start ...`, or direct `next start` processes for this app are not allowed as the normal operating mode. Use the user systemd service only. Do not stop unrelated system services.

Important: `ndda-web.service` is not the 8040 Next.js app. It is a different Python/uvicorn service from `/mnt/models/pdfapiocr` on port `8093`. Do not use `ndda-web.service` to restart this application.

## Operational service map

Use this section first when checking, restarting, or debugging the running system.

### Main web application

- purpose: applicant/admin/expert/reference web UI and Next.js API routes
- service: `ndda-8040.service`
- service scope: user systemd
- unit file: `/home/arman/.config/systemd/user/ndda-8040.service`
- working directory: `/mnt/models/NDDA_AI/8040/web`
- command: `/home/arman/.nvm/versions/node/v22.20.0/bin/npm run start -- -H 0.0.0.0 -p 8040`
- host/port: `0.0.0.0:8040`
- runtime: Next.js production server

Commands:

```bash
# Status
systemctl --user status ndda-8040.service --no-pager

# Logs
journalctl --user -u ndda-8040.service -n 100 --no-pager
journalctl --user -u ndda-8040.service -f

# Restart after successful build
cd /mnt/models/NDDA_AI/8040/web
npm run build
systemctl --user restart ndda-8040.service

# Stop/start if needed
systemctl --user stop ndda-8040.service
systemctl --user start ndda-8040.service

# Confirm only one 8040 listener exists
ss -ltnp | rg ':8040'
pgrep -af 'npm run start.*8040|next-server'
```

Rule: after frontend/backend TypeScript changes in `web`, build first, then restart `ndda-8040.service`. Do not start the web app with `nohup` or a manual background `npm run start`.

### Document parser microservice

- purpose: deterministic document preparation and parsing
- service: `ndda-document-parser.service`
- service scope: system systemd
- unit file: `/etc/systemd/system/ndda-document-parser.service`
- working directory: `/mnt/models/NDDA_AI/8040/services/document-parser`
- command: `/usr/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8051`
- host/port: `127.0.0.1:8051`
- runtime dir: `/mnt/models/NDDA_AI/8040/web/.runtime/document-parser`
- log file: `/mnt/models/NDDA_AI/8040/services/document-parser/parser-8051.log`
- main endpoints: `/health`, `/parse`, `/jobs`, `/jobs/{job_id}`, `/applications/{application_id}/jobs`

Commands:

```bash
# Status
systemctl status ndda-document-parser.service --no-pager

# Restart
sudo systemctl restart ndda-document-parser.service

# Logs
sudo journalctl -u ndda-document-parser.service -n 100 --no-pager
tail -f /mnt/models/NDDA_AI/8040/services/document-parser/parser-8051.log

# Health
curl -sS http://127.0.0.1:8051/health
```

### Gemma checker microservice

- purpose: semantic evaluation of extracted text/images against document requirement profiles
- service: `ndda-gemma-checker.service`
- service scope: system systemd
- unit file: `/etc/systemd/system/ndda-gemma-checker.service`
- working directory: `/mnt/models/NDDA_AI/8040/services/gemma-checker`
- command: `/usr/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8052`
- host/port: `127.0.0.1:8052`
- env file: `/mnt/models/NDDA_AI/8040/web/.env.local`
- runtime dir: `/mnt/models/NDDA_AI/8040/web/.runtime/gemma-checker`
- log file: `/mnt/models/NDDA_AI/8040/services/gemma-checker/gemma-checker-8052.log`
- main endpoints: `/health`, `/check`, `/jobs`, `/jobs/{job_id}`, `/applications/{application_id}/jobs`

Commands:

```bash
# Status
systemctl status ndda-gemma-checker.service --no-pager

# Restart
sudo systemctl restart ndda-gemma-checker.service

# Logs
sudo journalctl -u ndda-gemma-checker.service -n 100 --no-pager
tail -f /mnt/models/NDDA_AI/8040/services/gemma-checker/gemma-checker-8052.log

# Health
curl -sS http://127.0.0.1:8052/health
```

### NPA map constructor service

- purpose: separate NPA map constructor service
- service: `ndda-npa-map.service`
- service scope: system systemd
- unit file: `/etc/systemd/system/ndda-npa-map.service`
- working directory: `/mnt/models/NDDA_AI/8020`
- command: `/mnt/models/NDDA_AI/.venv/bin/uvicorn app.npa_map_app:app --host 0.0.0.0 --port 8020`
- host/port: `0.0.0.0:8020`

Commands:

```bash
# Status
systemctl status ndda-npa-map.service --no-pager

# Restart
sudo systemctl restart ndda-npa-map.service

# Logs
sudo journalctl -u ndda-npa-map.service -n 100 --no-pager
sudo journalctl -u ndda-npa-map.service -f
```

### Not the current 8040 app

The following service exists, but it is not the current NDDA AI 8040 Next.js app:

- service: `ndda-web.service`
- working directory: `/mnt/models/pdfapiocr`
- command: `/mnt/models/pdfapiocr/.venv/bin/python -m uvicorn ndda_web:app --host 0.0.0.0 --port 8093 --no-access-log`
- port: `8093`

Do not restart `ndda-web.service` when the task is to restart the `8040` web app.

### Database dependency

- runtime database: Postgres
- host/port: `127.0.0.1:55440`
- database: `ndda_reference_kb`
- user: `ndda_reference`
- DSN used by maintenance scripts: `postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb`

Quick check:

```bash
psql 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb' -c 'select 1;'
```

### Standard restart checklist

Use this order after code changes:

```bash
cd /mnt/models/NDDA_AI/8040/web
npm run build
systemctl --user restart ndda-8040.service
systemctl --user status ndda-8040.service --no-pager
curl -sS http://127.0.0.1:8040/api/admin/config >/dev/null
```

Use this order when parser/checker code changes:

```bash
sudo systemctl restart ndda-document-parser.service
sudo systemctl restart ndda-gemma-checker.service
curl -sS http://127.0.0.1:8051/health
curl -sS http://127.0.0.1:8052/health
```

Use this command before starting anything manually:

```bash
ss -ltnp | rg ':(8040|8051|8052|8020|8093)\b'
```

There must be only one listener for `8040`, and it must belong to `ndda-8040.service`.

## Services

### Document parser service

- service: `ndda-document-parser.service`
- port: `8051`
- role: fast deterministic parsing and document preparation
- output: text layer, page count, OCR candidate pages, image pages for scans
- it should not decide NPA compliance

### Gemma checker service

- service: `ndda-gemma-checker.service`
- port: `8052`
- role: semantic evaluation of document-check profiles against text chunks and image pages
- input: requirements, text chunks, image pages
- output: one status per requirement: `passed`, `failed`, `uncertain`, `not_applicable`, `skipped`

## Expert application pipeline

1. User/application files are stored in the runtime upload store.
2. Application records are stored in Postgres `runtime_applications`.
3. LS registration required documents are resolved through `/api/document-requirements/resolve` from Postgres `document_requirement_rules`.
4. Expert document table groups rows by exact full `dossierSectionCode`.
5. One full code section equals one expert row, for example `3.2.P.5.4`.
6. Multiple physical files under the same full section code are treated as one package.
7. Requirements are evaluated once per package, not once per file.
8. If any file/page in the package confirms a requirement, reduction may mark that requirement as passed.

## Required UI invariant

For a section such as `3.2.P.5.4` with three files and seven requirements, the expert UI must show:

- one row for `3.2.P.5.4`
- three files inside that row
- seven semantic requirements
- technical checks separately

It must not show 21 or 28 semantic requirements by multiplying requirements by files or by duplicated catalogs.

## API rules

- `GET /api/applications`: read all applications from Postgres.
- `POST /api/applications`: create/update one application.
- `PUT /api/applications`: bulk overwrite is disabled unless `x-ndda-bulk-write=true` is explicitly passed by a maintenance script.
- `DELETE /api/applications/{id}`: delete one application.
- `POST /api/applications/{id}/extract`: prepare text/image extraction state.
- `POST /api/applications/{id}/npa-gemma-check`: run semantic Gemma checks by section package.

## Frontend state rule

Browser local state must not overwrite Postgres. The frontend may cache data in React state, but persistence should happen through specific API calls for one application, not full-list localStorage synchronization.

## Document requirement catalog rule

For `LS + registration`, the runtime document catalog used by the expert/application flow must come from `/api/document-requirements/resolve` only. Do not merge it with admin config, seed catalog, or generated JSON at runtime. Merging those sources can duplicate `importedRequirements` and inflate UI counts.

## 2026-06-18: runtime without hidden fallbacks

- For `LS + registration`, document types and requirement profiles are runtime data from Postgres only. The checker does not merge Postgres rules with old seed/admin catalogs for this flow.
- PDF/image parsing must go through `DOCUMENT_PARSER_URL` (`ndda-document-parser`, port `8051`). If the service is unavailable, extraction fails visibly.
- Semantic NPA/Gemma checking must go through `GEMMA_CHECKER_URL` (`ndda-gemma-checker`, port `8052`). Direct in-process Gemma fallback is disabled.
- Expert rows are grouped by the full normalized dossier section code, for example `3.2.P.5.4`. Prefix grouping such as `3.2.P` is invalid.
- Multiple files under one exact section code are evaluated as one package against one deduplicated requirement profile. Requirement counts must not be multiplied by number of files.
