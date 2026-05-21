#!/usr/bin/env node

/**
 * openapi-type-sync-guard
 * -----------------------
 * Lightweight CI guard for the generated frontend OpenAPI type snapshot.
 *
 * This script does not start the backend and does not run codegen. It checks
 * whether files that define the currently generated chat wire contract changed
 * without a matching change to ai-assistant-ui/src/types/api-generated.d.ts.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const GENERATED_TYPES_FILE = 'ai-assistant-ui/src/types/api-generated.d.ts'

const CONTRACT_FILES = new Set([
  'ai-assistant-server/src/main/java/com/aiassistant/controller/AiAssistantController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/SseStreamController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/ChatResponse.java',
])

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2))
}

function runCli(argv) {
  const base = getArg(argv, '--base')
  const head = getArg(argv, '--head') ?? 'HEAD'
  const filesArg = getAllArgs(argv, '--file')
  const changedFiles =
    filesArg.length > 0 ? filesArg : collectChangedFiles(base ?? resolveDefaultBase(), head)
  const result = checkOpenApiTypeSync(changedFiles)

  if (result.ok) {
    console.log('openapi-type-sync-guard: generated frontend types are in sync')
    return
  }

  console.error('openapi-type-sync-guard: generated frontend types may be stale\n')
  console.error('Contract files changed:')
  for (const file of result.contractFiles) {
    console.error(`  - ${file}`)
  }
  console.error(`\nMissing matching change: ${GENERATED_TYPES_FILE}`)
  console.error(
    '\nRegenerate or review the snapshot with `node scripts/generate-frontend-types.mjs` ' +
      'and commit the generated type diff with the backend contract change.',
  )
  process.exit(1)
}

export function checkOpenApiTypeSync(changedFiles) {
  const normalized = normalizeNames(changedFiles)
  const changedSet = new Set(normalized)
  const contractFiles = normalized.filter((file) => CONTRACT_FILES.has(file))
  const generatedTypesChanged = changedSet.has(GENERATED_TYPES_FILE)
  return {
    ok: contractFiles.length === 0 || generatedTypesChanged,
    contractFiles,
    generatedTypesChanged,
  }
}

function collectChangedFiles(base, head) {
  const args = ['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`]
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`)
  }
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

function resolveDefaultBase() {
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`
  }
  return 'origin/main'
}

function getArg(args, key) {
  const i = args.indexOf(key)
  if (i < 0 || i === args.length - 1) return null
  return args[i + 1]
}

function getAllArgs(args, key) {
  const values = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === key && i < args.length - 1) values.push(args[++i])
  }
  return values
}

function normalizeNames(names) {
  return [...new Set(names.map((name) => name.replace(/\\/g, '/')).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}
