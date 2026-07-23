#!/usr/bin/env node

/**
 * multi-replica-config-lint
 * --------------------------
 * 检查独立服务（standalone）部署在多实例环境下时配置的安全性。
 *
 * 触发场景：
 * - 多实例部署，但 .env 里只用了进程内限流（`AI_ASSISTANT_RATE_LIMIT > 0` 且没有 Redis）
 * - 多实例部署，但没有可识别的 Spring Data Redis 连接配置
 * - 多实例部署且开启 RAG（仓库只交付 InMemoryVectorStore）
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

const readableFiles = filesToCheck
  .filter(file => existsSync(file))
  .map(file => ({ file, raw: readFileSync(file, 'utf8') }))

const detectedReplicasAcrossFiles = readableFiles.reduce((max, { file, raw }) => {
  if (!file.endsWith('.yml') && !file.endsWith('.yaml')) return max
  const match = raw.match(/\b(?:replicas|replicaCount):\s*(\d+)/)
  return match ? Math.max(max, Number.parseInt(match[1], 10)) : max
}, 0)

for (const { file, raw } of readableFiles) {
  const env = file.endsWith('.env') || file.endsWith('.env.example')
  const yaml = file.endsWith('.yml') || file.endsWith('.yaml')

  let detectedReplicas = 0
  if (yaml) {
    const m = raw.match(/\b(?:replicas|replicaCount):\s*(\d+)/)
    if (m) detectedReplicas = parseInt(m[1], 10)
  }
  const effectiveReplicas = Math.max(replicas, detectedReplicasAcrossFiles)

  if (env) {
    const rateLimit = pickEnv(raw, 'AI_ASSISTANT_RATE_LIMIT')
    const ragEnabled = pickEnv(raw, 'AI_ASSISTANT_RAG_ENABLED')
    const redisHost = pickEnv(raw, 'SPRING_DATA_REDIS_HOST')
    const redisUrl = pickEnv(raw, 'SPRING_DATA_REDIS_URL')
    const distributedRateLimit = pickEnv(raw, 'AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED')
    const hasRedisConfig = Boolean(redisHost || redisUrl)

    const limit = rateLimit ? parseInt(rateLimit, 10) : NaN

    if (
      (effectiveReplicas > 1 || replicas === 0) &&
      Number.isFinite(limit) &&
      limit > 0 &&
      !(hasRedisConfig && distributedRateLimit === 'true')
    ) {
      findings.push({
        file,
        severity: effectiveReplicas > 1 ? 'high' : 'warn',
        rule: 'in-process-rate-limit',
        message:
          `AI_ASSISTANT_RATE_LIMIT=${limit} 是进程内限流，多实例部署时各副本各算各的；` +
          '生产请在 API 网关限流，或同时提供 Spring Data Redis 运行时、连接配置并确认 RedisRateLimitFilter 已接管',
      })
    }

    if (
      (effectiveReplicas > 1 || replicas === 0) &&
      !hasRedisConfig
    ) {
      findings.push({
        file,
        severity: effectiveReplicas > 1 ? 'high' : 'info',
        rule: 'in-memory-session-store',
        message:
          '未发现 SPRING_DATA_REDIS_HOST/URL，默认 InMemorySessionStore；多实例部署会话不共享。' +
          '请让运行时包含 Spring Data Redis、配置连接，并从启动日志/Bean 检查确认 RedisSessionStore 已接管',
      })
    }

    if (
      (effectiveReplicas > 1 || replicas === 0) &&
      ragEnabled === 'true'
    ) {
      findings.push({
        file,
        severity: effectiveReplicas > 1 ? 'high' : 'warn',
        rule: 'in-memory-rag-store',
        message:
          'RAG 已开启；仓库只交付 InMemoryVectorStore，多实例间索引不共享。' +
          '必须由宿主注入经过契约测试的共享 VectorStore；设置一个未被应用读取的环境变量不能消除此风险',
      })
    }
  }

  if (yaml && detectedReplicas > 1) {
    findings.push({
      file,
      severity: 'info',
      rule: 'detected-multi-replica',
      message: `检测到副本数 ${detectedReplicas}；请确认限流、会话、用量、记忆和 RAG 已切到共享实现`,
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
