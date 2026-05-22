#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function parseArgs(argv) {
  const args = {
    url: 'http://localhost:8080/ai-assistant/v3/api-docs',
    specFile: null,
    out: 'docs/api/openapi.json',
    typesOut: 'ai-assistant-ui/src/types/api-generated.d.ts',
    token: null,
    pin: 'openapi-typescript@7',
    skipTypes: false,
    check: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--url') args.url = argv[++i]
    else if (arg === '--spec-file') args.specFile = argv[++i]
    else if (arg === '--out') args.out = argv[++i]
    else if (arg === '--types-out') args.typesOut = argv[++i]
    else if (arg === '--token') args.token = argv[++i]
    else if (arg === '--pin') args.pin = argv[++i]
    else if (arg === '--skip-types') args.skipTypes = true
    else if (arg === '--check') args.check = true
    else if (arg === '-h' || arg === '--help') {
      console.log(
        'Usage: node scripts/refresh-openapi-snapshot.mjs ' +
          '[--url <openapi-json-url> | --spec-file <openapi-json>] [--out docs/api/openapi.json] ' +
          '[--types-out ai-assistant-ui/src/types/api-generated.d.ts] [--token <X-AI-Token>] ' +
          '[--pin openapi-typescript@<ver>] [--skip-types] [--check]',
      )
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}. Pass --help for usage.`)
    }
  }
  return args
}

export function normalizeSpecText(specText) {
  return `${JSON.stringify(JSON.parse(specText), null, 2)}\n`
}

export async function assertSnapshotMatches(outPath, specText) {
  const currentText = await readFile(outPath, 'utf8')
  const current = normalizeSpecText(currentText)
  if (current !== specText) {
    const drift = summarizeSpecDrift(currentText, specText)
    throw new Error(
      `${outPath} is stale. Re-run refresh-openapi-snapshot without --check.\n${drift}`,
    )
  }
}

export function summarizeSpecDrift(currentText, nextText) {
  let current
  let next
  try {
    current = JSON.parse(currentText)
    next = JSON.parse(nextText)
  } catch {
    return 'Drift summary unavailable: one of the OpenAPI documents is not valid JSON.'
  }

  const lines = ['Drift summary:']
  lines.push(...summarizeKeys('paths', current.paths, next.paths))
  lines.push(
    ...summarizeKeys(
      'schemas',
      current.components?.schemas,
      next.components?.schemas,
    ),
  )
  const currentVersion = current.info?.version
  const nextVersion = next.info?.version
  if (currentVersion !== nextVersion) {
    lines.push(`info.version changed: ${currentVersion ?? '(missing)'} -> ${nextVersion ?? '(missing)'}`)
  }
  if (lines.length === 1) {
    lines.push('no path/schema key changes detected; content differs inside existing entries.')
  }
  return lines.join('\n')
}

function summarizeKeys(label, current = {}, next = {}) {
  const before = new Set(Object.keys(current ?? {}))
  const after = new Set(Object.keys(next ?? {}))
  const added = [...after].filter((key) => !before.has(key)).sort()
  const removed = [...before].filter((key) => !after.has(key)).sort()
  const lines = []
  if (added.length > 0) lines.push(`${label} added: ${added.join(', ')}`)
  if (removed.length > 0) lines.push(`${label} removed: ${removed.join(', ')}`)
  return lines
}

async function loadSpecText(args) {
  if (args.specFile) {
    return readFile(resolve(repoRoot, args.specFile), 'utf8')
  }
  const headers = { Accept: 'application/json' }
  if (args.token) headers['X-AI-Token'] = args.token
  const response = await fetch(args.url, { headers })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Spec fetch returned HTTP ${response.status} ${response.statusText}. Body snippet: ${body.slice(0, 200)}`,
    )
  }
  return response.text()
}

async function main() {
  const args = parseArgs(process.argv)
  const outPath = resolve(repoRoot, args.out)
  const specText = normalizeSpecText(await loadSpecText(args))
  if (args.check) {
    await assertSnapshotMatches(outPath, specText)
    if (args.skipTypes) {
      console.log('[refresh-openapi-snapshot] --check: snapshot is up to date')
      return
    }
  } else {
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, specText, 'utf8')
    console.log(`[refresh-openapi-snapshot] Wrote ${args.out}`)
  }

  if (args.skipTypes) return
  const result = spawnSync(
    process.execPath,
    [
      'scripts/generate-frontend-types.mjs',
      '--spec-file',
      args.out,
      ...(args.check ? ['--check'] : []),
      '--out',
      args.typesOut,
      '--pin',
      args.pin,
    ],
    { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`generate-frontend-types exited with code ${result.status}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('[refresh-openapi-snapshot] FAILED:', error.message)
    process.exit(1)
  })
}
