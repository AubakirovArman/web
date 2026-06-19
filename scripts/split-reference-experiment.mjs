#!/usr/bin/env node
// Splits an already-generated experiment.json into runtime artifacts:
//   public/reference-intelligence/index.json  (lightweight list)
//   public/reference-intelligence/docs/<id>.json (full per-document)
// Run after the experiment file changes, or rely on the generator which now
// produces these automatically.

import fs from 'node:fs/promises';
import path from 'node:path';
import { writeSplitOutput } from './reference-intelligence/split-output.mjs';

const outputDir = path.resolve(process.cwd(), 'public/reference-intelligence');
const fullPath = path.join(outputDir, 'experiment.json');

async function main() {
  let raw;
  try {
    raw = await fs.readFile(fullPath, 'utf-8');
  } catch {
    console.error(`Not found: ${fullPath}. Run "npm run reference:intelligence:experiment" first.`);
    process.exit(1);
  }

  const t0 = Date.now();
  const data = JSON.parse(raw);
  const result = await writeSplitOutput(outputDir, data);
  console.log(
    `split done in ${Date.now() - t0}ms: index.json (${result.documents} docs) + docs/ (${result.docFiles} files)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
