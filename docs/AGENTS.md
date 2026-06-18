# Maintenance notes for Codex agents

Keep this file updated when changing the application/document-checking architecture.

## Before changing expert checks

1. Confirm the active web process is the managed `ndda-8040-web.service` process.
2. Confirm parser and checker services are active:
   - `ndda-document-parser.service`
   - `ndda-gemma-checker.service`
3. Confirm port ownership:
   - web: `8040`
   - parser: `8051`
   - checker: `8052`
   - Postgres: `55440`
4. Confirm LS registration rules are in Postgres, not loaded from generated JSON.

## Do not do

- Do not commit real registration dossier files.
- Do not commit reports containing sensitive full dossier paths unless explicitly approved.
- Do not re-enable local JSON fallback for LS registration runtime checks.
- Do not run multiple manual `next start` processes for `/mnt/models/NDDA_AI/8040/web`.
- Do not multiply semantic requirements by the number of files in one dossier section.

## Expected behavior for package checks

A package is identified by exact normalized section code, for example `3.2.P.5.4`.

All files with that exact code are evaluated together. The checker receives one requirement profile for that section and all available text/image evidence from all files in the package.

## Useful diagnostics

Check active app processes:

```bash
for pid in $(pgrep -f 'next-server|npm run start|next dev' | sort -n); do
  [ -d /proc/$pid ] || continue
  cwd=$(readlink /proc/$pid/cwd 2>/dev/null || true)
  cmd=$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null || true)
  case "$cwd:$cmd" in *'/mnt/models/NDDA_AI/8040/web'*) printf 'PID=%s CWD=%s CMD=%s\n' "$pid" "$cwd" "$cmd";; esac
done
```

Check runtime services:

```bash
systemctl status ndda-8040-web.service ndda-document-parser.service ndda-gemma-checker.service --no-pager
```

Check section `3.2.P.5.4` rule count:

```bash
psql 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb' -Atc \
"select id, doc_code, document_type_id, jsonb_array_length(coalesce(validation_checks,'[]'::jsonb)) from document_requirement_rules where upper(replace(doc_code,'Р','P'))='3.2.P.5.4';"
```

Expected semantic requirement count for current `3.2.P.5.4` profile: `7`.

## Operational rule: no silent fallback

When working on extraction/checking, do not add fallback paths that hide service or database failures. For the LS registration pipeline:

- Missing Postgres rules should be an error, not a seed JSON fallback.
- Missing `DOCUMENT_PARSER_URL` should be an error for PDF/image extraction.
- Missing `GEMMA_CHECKER_URL` should be an error for semantic requirement checks.
- If one dossier section has several files, keep one row and one requirement set for the full section code.
- Before restarting, stop only `/mnt/models/NDDA_AI/8040/web` Next processes. Do not stop unrelated system services.
