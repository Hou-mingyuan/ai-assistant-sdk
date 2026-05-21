#!/usr/bin/env node

/**
 * openapi-type-sync-guard
 * -----------------------
 * Lightweight CI guard for the generated frontend OpenAPI type snapshot.
 *
 * This script does not start the backend and does not run codegen. It checks
 * whether files that define the currently generated REST wire contract changed
 * without matching changes to the static OpenAPI snapshot and generated
 * frontend TypeScript types.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const GENERATED_TYPES_FILE = 'ai-assistant-ui/src/types/api-generated.d.ts'
export const OPENAPI_SPEC_FILE = 'docs/api/openapi.json'

const CONTRACT_FILES = new Set([
  'ai-assistant-server/src/main/java/com/aiassistant/config/ConnectorProperties.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/AdminDashboardController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/AiAssistantController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/AssistantExportController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/AsyncTaskController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/BatchController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/CapabilityController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/ConnectorHealthController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/FileUploadController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/PromptTemplateController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/RuntimeConfigController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/RuntimeModelConfigController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/SessionController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/SseStreamController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/controller/StatsController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/mcp/McpServerController.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/ChatResponse.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/ExportRequest.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/ModelsListResponse.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/SessionData.java',
  'ai-assistant-server/src/main/java/com/aiassistant/model/UrlPreviewResponse.java',
  'ai-assistant-server/src/main/java/com/aiassistant/service/RuntimeModelConfigService.java',
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
  console.error('\nMissing matching changes:')
  for (const file of result.missingFiles) {
    console.error(`  - ${file}`)
  }
  console.error(
    '\nRegenerate or review the snapshot with `node scripts/generate-frontend-types.mjs` ' +
      'and commit both the OpenAPI snapshot and generated type diff with the backend contract change.',
  )
  process.exit(1)
}

export function checkOpenApiTypeSync(changedFiles) {
  const normalized = normalizeNames(changedFiles)
  const changedSet = new Set(normalized)
  const contractFiles = normalized.filter((file) => CONTRACT_FILES.has(file))
  const openapiSpecChanged = changedSet.has(OPENAPI_SPEC_FILE)
  const generatedTypesChanged = changedSet.has(GENERATED_TYPES_FILE)
  const missingFiles = []
  if (contractFiles.length > 0 && !openapiSpecChanged) missingFiles.push(OPENAPI_SPEC_FILE)
  if ((contractFiles.length > 0 || openapiSpecChanged) && !generatedTypesChanged) {
    missingFiles.push(GENERATED_TYPES_FILE)
  }
  return {
    ok: missingFiles.length === 0,
    contractFiles,
    openapiSpecChanged,
    generatedTypesChanged,
    missingFiles,
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
