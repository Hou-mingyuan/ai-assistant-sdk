#!/usr/bin/env node
/**
 * generate-frontend-types.mjs
 * ---------------------------
 * Pull the OpenAPI 3.1 schema from a running ai-assistant-service /
 * ai-assistant-server instance and codegen TypeScript types into
 *   ai-assistant-ui/src/types/api-generated.d.ts
 *
 * This script is a Phase-6 "scaffold": it intentionally does NOT take a
 * dependency on `openapi-typescript` (or any other codegen library) in
 * ai-assistant-ui/package.json. Instead it invokes `npx --yes
 * openapi-typescript@<version>`, which downloads the tool on demand. That
 * keeps the runtime bundle clean and lets us upgrade the codegen tool
 * independently of the library.
 *
 * Prerequisites (manual, not enforced by this script)
 * ---------------------------------------------------
 * 1. Add `springdoc-openapi-starter-webmvc-ui` as a non-optional dependency
 *    to the host that's actually running (ai-assistant-service does so by
 *    inheriting the optional starter dependency; if you're testing against
 *    the Starter directly, declare it yourself).
 * 2. Set `ai-assistant.openapi.enabled=true` in application.yml.
 * 3. Start the service so `/v3/api-docs` returns a JSON spec:
 *      cd ai-assistant-service
 *      mvn spring-boot:run
 *    (default endpoint: http://localhost:8080/ai-assistant/v3/api-docs)
 * 4. From the repo root, run this script:
 *      node scripts/generate-frontend-types.mjs
 *    Optional flags:
 *      --url <openapi-json-url>     Default: http://localhost:8080/ai-assistant/v3/api-docs
 *      --spec-file <openapi-json>   Read an already exported OpenAPI JSON file instead of fetch()
 *      --out <output-file>          Default: ai-assistant-ui/src/types/api-generated.d.ts
 *      --token <X-AI-Token value>   If the host gates /v3/api-docs behind auth
 *      --pin <openapi-typescript@x> Default: openapi-typescript@7
 *      --check                      Generate to a temp file and fail if committed output differs
 *
 * After this completes, the file at the output path is the source of truth
 * for backend wire types. Import from it as
 *   `import type { components, paths } from '@/types/api-generated';`
 * and use `components['schemas']['ChatRequest']`, etc. The file is
 * regenerated, so commit it alongside the server contract change.
 *
 * Audit hook
 * ----------
 * `scripts/bundle-size-check.mjs` does NOT track this file (it's a .d.ts,
 * stripped at build time). The CI workflow should call this script with
 * `--check` to verify generated TypeScript did not drift from the live
 * OpenAPI spec — see the "CI integration" section of
 * docs/guide/openapi-typescript-codegen.md.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), '..');

// ─────────────────────────────────────────────────────────────────────────
// CLI argument parsing (no third-party dependency)
// ─────────────────────────────────────────────────────────────────────────
export function parseArgs(argv) {
  const args = {
    url: 'http://localhost:8080/ai-assistant/v3/api-docs',
    specFile: null,
    out: 'ai-assistant-ui/src/types/api-generated.d.ts',
    token: null,
    pin: 'openapi-typescript@7',
    dryRun: false,
    check: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--spec-file') args.specFile = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--token') args.token = argv[++i];
    else if (a === '--pin') args.pin = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check') args.check = true;
    else if (a === '-h' || a === '--help') {
      console.log(
        'Usage: node scripts/generate-frontend-types.mjs ' +
          '[--url <openapi-json-url>] [--spec-file <openapi-json>] [--out <file>] [--token <X-AI-Token>] ' +
          '[--pin openapi-typescript@<ver>] [--dry-run] [--check]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}. Pass --help for usage.`);
      process.exit(2);
    }
  }
  return args;
}

// ─────────────────────────────────────────────────────────────────────────
// Fetch the OpenAPI spec from the live host
// ─────────────────────────────────────────────────────────────────────────
async function fetchSpec(url, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers['X-AI-Token'] = token;
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (e) {
    throw new Error(
      `Failed to connect to ${url}. Is ai-assistant-service running, and ` +
        `is ai-assistant.openapi.enabled=true? Cause: ${e.message}`,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Spec fetch returned HTTP ${response.status} ${response.statusText}. ` +
        `Body snippet: ${body.slice(0, 200)}`,
    );
  }
  return await response.text();
}

export async function loadSpecText(args) {
  if (args.specFile) {
    const specPath = resolve(repoRoot, args.specFile);
    return await readFile(specPath, 'utf-8');
  }
  return await fetchSpec(args.url, args.token);
}

// ─────────────────────────────────────────────────────────────────────────
// Run `npx openapi-typescript <spec> -o <out>`
// ─────────────────────────────────────────────────────────────────────────
export function openApiSourceDigest(specText) {
  const normalized = JSON.stringify(JSON.parse(specText));
  return createHash('sha256').update(normalized).digest('hex');
}

export function stampGeneratedTypesContent(generatedTypes, specText) {
  const marker = '/** OpenAPI source SHA-256: ' + openApiSourceDigest(specText) + ' */';
  const withoutOldMarker = generatedTypes.replace(
    /^\/\*\* OpenAPI source SHA-256: [a-f0-9]{64} \*\/\r?\n/,
    '',
  );
  return marker + '\n' + withoutOldMarker;
}

async function stampGeneratedTypes(specPath, outPath) {
  const [specText, generatedTypes] = await Promise.all([
    readFile(specPath, 'utf-8'),
    readFile(outPath, 'utf-8'),
  ]);
  await writeFile(outPath, stampGeneratedTypesContent(generatedTypes, specText), 'utf-8');
}

async function runCodegen(specPath, outPath, pinned) {
  // Use shell: true on Windows for npx.cmd resolution; otherwise direct.
  return new Promise((resolveRun, rejectRun) => {
    const isWindows = process.platform === 'win32';
    const child = spawn(
      'npx',
      ['--yes', pinned, specPath, '-o', outPath],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: isWindows,
      },
    );
    child.on('exit', async (code) => {
      if (code === 0) {
        try {
          await stampGeneratedTypes(specPath, outPath);
          resolveRun();
        } catch (error) {
          rejectRun(error);
        }
      } else {
        rejectRun(new Error(`openapi-typescript exited with code ${code}`));
      }
    });
    child.on('error', (e) =>
      rejectRun(new Error(`Failed to spawn npx: ${e.message}`)),
    );
  });
}

function normalizeGeneratedTypes(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

async function assertGeneratedTypesUpToDate(expectedPath, actualPath) {
  const [expected, actual] = await Promise.all([
    readFile(expectedPath, 'utf-8'),
    readFile(actualPath, 'utf-8'),
  ]);
  if (normalizeGeneratedTypes(expected) === normalizeGeneratedTypes(actual)) {
    return;
  }
  throw new Error(
    `OpenAPI TypeScript drift detected. Regenerate ${actualPath} with ` +
      '`node scripts/generate-frontend-types.mjs` and commit the result.',
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (args.dryRun && args.check) {
    throw new Error('Use either --dry-run or --check, not both.');
  }
  const source = args.specFile ? args.specFile : args.url;
  console.log(`[generate-frontend-types] Loading OpenAPI spec from ${source}`);
  const specText = await loadSpecText(args);
  console.log(
    `[generate-frontend-types] Got ${specText.length} bytes of OpenAPI JSON`,
  );

  // Write the spec to a tmp file the codegen can read
  const tmpDir = join(repoRoot, '.openapi-tmp');
  await mkdir(tmpDir, { recursive: true });
  const specPath = join(tmpDir, 'openapi.json');
  await writeFile(specPath, specText, 'utf-8');
  console.log(`[generate-frontend-types] Spec cached at ${specPath}`);

  const outAbsolute = resolve(repoRoot, args.out);
  await mkdir(dirname(outAbsolute), { recursive: true });

  if (args.dryRun) {
    console.log(
      `[generate-frontend-types] --dry-run: spec fetched and validated, NOT writing ${args.out}`,
    );
    process.exit(0);
  }

  if (args.check) {
    const checkOut = join(tmpDir, 'api-generated.check.d.ts');
    console.log(
      `[generate-frontend-types] --check: codegen with ${args.pin} → ${checkOut}`,
    );
    await runCodegen(specPath, checkOut, args.pin);
    await assertGeneratedTypesUpToDate(checkOut, outAbsolute);
    console.log('[generate-frontend-types] --check: generated types are up to date');
    process.exit(0);
  }

  console.log(
    `[generate-frontend-types] Codegen with ${args.pin} → ${args.out}`,
  );
  await runCodegen(specPath, outAbsolute, args.pin);
  console.log(
    `[generate-frontend-types] Done. Review the diff, commit ${args.out} ` +
      `alongside the server contract change.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main().catch((e) => {
    console.error('[generate-frontend-types] FAILED:', e.message);
    process.exit(1);
  });
}
