#!/usr/bin/env node

/**
 * multi-replica-config-lint
 * --------------------------
 * 检查独立服务（standalone）部署在多实例环境下时配置的安全性。
 *
 * 触发场景：
 * - 多实例部署，但 .env 里只用了进程内限流（`AI_ASSISTANT_RATE_LIMIT > 0` 且没有 Redis）
 * - 多实例部署，但 session 存储是进程内 InMemorySessionStore
 * - 多实例部署，但 RAG vector store 是 InMemoryVectorStore
 *
 * 默认 dry-run，只打印告警；加 `--strict` 时遇到任何高严重度问题 exit 1
 * （适合 CI 中阻塞 PR）。
 *
 * 用法：
 *   node scripts/multi-replica-config-lint.mjs                # 检查所有 .env / .env.example
 *   node scripts/multi-replica-config-lint.mjs --strict       # 高严重度则 exit 1
 *   node scripts/multi-replica-config-lint.mjs --file path.env # 指定单个文件
 *   node scripts/multi-replica-config-lint.mjs --replicas 3   # 显式声明副本数（>1 触发严格检查）
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const strict = argv.includes('--strict')

let replicas = parseInt(getArg(argv, '--replicas') ?? '0', 10) || 0
const filesArg = getArg(argv, '--file')

const filesToCheck = filesArg
  ? [filesArg]
  : [
      path.join(root, '.env'),
      path.join(root, '.env.example'),
      path.join(root, 'docker-compose.yml'),
      path.join(root, 'docker-compose.ghcr.yml'),
      path.join(root, 'docker-compose.prod.yml'),
      path.join(root, 'helm/ai-assistant/values.yaml'),
    ]

const findings = []

for (const file of filesToCheck) {
  if (!existsSync(file)) continue
  const raw = readFileSync(file, 'utf8')
  const env = file.endsWith('.env') || file.endsWith('.env.example')
  const yaml = file.endsWith('.yml') || file.endsWith('.yaml')

  let detectedReplicas = 0
  if (yaml) {
    const m = raw.match(/\breplicas:\s*(\d+)/)
    if (m) detectedReplicas = parseInt(m[1], 10)
  }
  const effectiveReplicas = Math.max(replicas, detectedReplicas)

  if (env) {
    const rateLimit = pickEnv(raw, 'AI_ASSISTANT_RATE_LIMIT')
    const sessionStore = pickEnv(raw, 'AI_ASSISTANT_SESSION_STORE')
    const ragEnabled = pickEnv(raw, 'AI_ASSISTANT_RAG_ENABLED')
    const ragStoreType = pickEnv(raw, 'AI_ASSISTANT_RAG_VECTOR_STORE')

    const limit = rateLimit ? parseInt(rateLimit, 10) : NaN

    if (
      (effectiveReplicas > 1 || replicas === 0) &&
      Number.isFinite(limit) &&
      limit > 0 &&
      !raw.toLowerCase().includes('redis')
    ) {
      findings.push({
        file,
        severity: effectiveReplicas > 1 ? 'high' : 'warn',
        rule: 'in-process-rate-limit',
        message:
          `AI_ASSISTANT_RATE_LIMIT=${limit} 是进程内限流，多实例部署时各副本各算各的；` +
          '生产请改在 API 网关或 Redis (RedisRateLimitFilter) 上做配额',
      })
    }

    if (
      (effectiveReplicas > 1 || replicas === 0) &&
      (sessionStore == null || sessionStore.toLowerCase() === 'inmemory')
    ) {
      findings.push({
        file,
        severity: effectiveReplicas > 1 ? 'high' : 'info',
        rule: 'in-memory-session-store',
        message:
          'session store 未声明，默认 InMemorySessionStore；多实例部署会话粘连不稳定，' +
          '请配 AI_ASSISTANT_SESSION_STORE=redis 并提供 redis URL',
      })
    }

    if (
      (effectiveReplicas > 1 || replicas === 0) &&
      ragEnabled === 'true' &&
      (ragStoreType == null || ragStoreType.toLowerCase() === 'inmemory')
    ) {
      findings.push({
        file,
        severity: effectiveReplicas > 1 ? 'high' : 'warn',
        rule: 'in-memory-rag-store',
        message:
          'RAG 已开启但 vector store 是 InMemoryVectorStore；多实例间检索结果不一致，' +
          '生产应换成 Milvus / Pinecone / Qdrant',
      })
    }
  }

  if (yaml && detectedReplicas > 1) {
    findings.push({
      file,
      severity: 'info',
      rule: 'detected-multi-replica',
      message: `检测到 replicas: ${detectedReplicas}；请确认 .env 中的限流/会话/RAG 已切到分布式存储`,
    })
  }
}

if (findings.length === 0) {
  console.log('multi-replica-config-lint: no issues found')
  process.exit(0)
}

const colors = {
  high: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  reset: '\x1b[0m',
}

console.log('multi-replica-config-lint findings:\n')
for (const f of findings) {
  const c = colors[f.severity] ?? ''
  const rel = path.relative(root, f.file)
  console.log(`${c}[${f.severity.toUpperCase()}]${colors.reset} ${rel} — ${f.rule}`)
  console.log(`  ${f.message}\n`)
}

const hasHigh = findings.some((f) => f.severity === 'high')
if (strict && hasHigh) {
  console.error('strict mode: high-severity findings present, exit 1')
  process.exit(1)
}

console.log(`Found ${findings.length} finding(s); high-severity: ${findings.filter((f) => f.severity === 'high').length}`)
process.exit(0)

function getArg(args, key) {
  const i = args.indexOf(key)
  if (i < 0 || i === args.length - 1) return null
  return args[i + 1]
}

function pickEnv(raw, key) {
  const re = new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm')
  const m = raw.match(re)
  if (!m) return null
  const v = m[1].trim()
  if (v === '' || v === '${' + key + '}') return null
  return v
}
