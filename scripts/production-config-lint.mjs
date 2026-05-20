#!/usr/bin/env node

/**
 * production-config-lint
 * ----------------------
 * Static safety lint for standalone production configuration. It reads .env,
 * docker-compose env defaults, or Helm values and reports risky AI Assistant
 * settings before deployment.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2))
}

function runCli(argv) {
  const strict = argv.includes('--strict')
  const includeExamples = argv.includes('--include-examples')
  const fileArgs = getAllArgs(argv, '--file')

  const defaultFiles = [
    path.join(root, '.env'),
    path.join(root, 'docker-compose.prod.yml'),
    path.join(root, 'helm/ai-assistant/values.yaml'),
  ]

  if (includeExamples) {
    defaultFiles.push(path.join(root, '.env.example'), path.join(root, 'docker-compose.yml'))
  }

  const filesToCheck = fileArgs.length > 0 ? fileArgs : defaultFiles
  const findings = []

  for (const file of filesToCheck) {
    if (!existsSync(file)) continue
    const raw = readFileSync(file, 'utf8')
    const env = parseConfigText(raw)
    findings.push(
      ...lintProductionConfig(env, {
        file,
        template: isTemplateFile(file),
      }),
    )
  }

  if (findings.length === 0) {
    console.log('production-config-lint: no issues found')
    process.exit(0)
  }

  const colors = {
    high: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[36m',
    reset: '\x1b[0m',
  }

  console.log('production-config-lint findings:\n')
  for (const f of findings) {
    const c = colors[f.severity] ?? ''
    const rel = path.relative(root, f.file)
    console.log(`${c}[${f.severity.toUpperCase()}]${colors.reset} ${rel} — ${f.rule}`)
    console.log(`  ${f.message}\n`)
  }

  const highCount = findings.filter((f) => f.severity === 'high').length
  if (strict && highCount > 0) {
    console.error('strict mode: high-severity findings present, exit 1')
    process.exit(1)
  }

  console.log(`Found ${findings.length} finding(s); high-severity: ${highCount}`)
  process.exit(0)
}

export function lintProductionConfig(env, options = {}) {
  const file = options.file ?? '<memory>'
  const template = options.template === true
  const out = []
  const severity = (level) => (template && level === 'high' ? 'warn' : level)
  const push = (level, rule, message) => {
    out.push({ file, severity: severity(level), rule, message })
  }

  const apiKey = pick(env, 'AI_ASSISTANT_API_KEY')
  const accessToken = pick(env, 'AI_ASSISTANT_ACCESS_TOKEN')
  const adminToken = pick(env, 'AI_ASSISTANT_ADMIN_TOKEN')
  const allowedOrigins = pick(env, 'AI_ASSISTANT_ALLOWED_ORIGINS')

  if (isMissingOrExampleSecret(apiKey, ['sk-your-key'])) {
    push('high', 'missing-api-key', 'AI_ASSISTANT_API_KEY 为空或仍是示例值，生产无法安全调用模型供应商')
  }

  if (isMissingOrExampleSecret(accessToken, ['change-me', 'ci-token'])) {
    push('high', 'missing-access-token', 'AI_ASSISTANT_ACCESS_TOKEN 为空或仍是示例值，公网部署会暴露业务接口')
  }

  if (isBlank(allowedOrigins) || allowedOrigins === '*') {
    push('high', 'wide-open-cors', 'AI_ASSISTANT_ALLOWED_ORIGINS 为空或为 *，生产应改为明确前端域名')
  }

  if (isTrue(pick(env, 'AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH'))) {
    push('high', 'query-token-auth', 'AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=true 会让 token 出现在 URL、日志和浏览器历史中')
  }

  if (isTrue(pick(env, 'AI_ASSISTANT_ALLOW_CLIENT_SYSTEM_PROMPT'))) {
    push('warn', 'client-system-prompt', 'AI_ASSISTANT_ALLOW_CLIENT_SYSTEM_PROMPT=true；如生产需要统一助手角色，建议关闭')
  }

  if (isFalse(pick(env, 'AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION'))) {
    push('high', 'ssrf-protection-disabled', 'AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION=false，链接抓取可能访问内网或元数据地址')
  }

  if (isTrue(pick(env, 'AI_ASSISTANT_ADMIN_ENABLED'))) {
    if (isBlank(adminToken)) {
      push('warn', 'admin-token-fallback', 'Admin 已启用但 AI_ASSISTANT_ADMIN_TOKEN 为空，将回退使用 access token；生产建议配置独立 admin token')
    }
    if (isMissingOrExampleSecret(accessToken, ['change-me', 'ci-token']) && isBlank(adminToken)) {
      push('high', 'admin-without-token', 'Admin 已启用但 access/admin token 都不可用，管理面保护不足')
    }
  }

  for (const [key, rule, label] of [
    ['AI_ASSISTANT_MCP_SERVER_ENABLED', 'mcp-enabled', 'MCP Server'],
    ['AI_ASSISTANT_CONNECTOR_MANAGEMENT_ENABLED', 'connector-management-enabled', '连接器管理'],
    ['AI_ASSISTANT_WEBSOCKET_ENABLED', 'websocket-enabled', 'WebSocket'],
  ]) {
    if (isTrue(pick(env, key))) {
      const level = isMissingOrExampleSecret(accessToken, ['change-me', 'ci-token']) ? 'high' : 'warn'
      push(level, rule, `${label} 已启用；请确认它只暴露在受保护网络或网关鉴权之后`)
    }
  }

  if (isTrue(pick(env, 'AI_ASSISTANT_HEADLESS_FETCH_ENABLED'))) {
    push('warn', 'headless-fetch-enabled', 'Headless 抓取已启用；生产应确认浏览器沙箱、网络出口和超时限制')
  }

  const actuator = pick(env, 'MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE')
  if (actuator && /(^|,|\s)(env|configprops|heapdump|threaddump|beans)(,|\s|$)/i.test(actuator)) {
    push('high', 'sensitive-actuator-exposure', `Actuator 暴露了敏感端点 (${actuator})，生产只建议 health,info 或受保护 metrics`)
  }

  if (isTrue(pick(env, 'MANAGEMENT_INFO_ENV_ENABLED'))) {
    push('warn', 'management-info-env', 'MANAGEMENT_INFO_ENV_ENABLED=true 可能扩大 /actuator/info 信息面；生产建议关闭或置于内网')
  }

  return out
}

export function parseConfigText(raw) {
  const env = new Map()
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const envMatch = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (envMatch) {
      env.set(envMatch[1], stripQuotes(envMatch[2]))
      continue
    }

    const composeMatch = trimmed.match(/^-\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (composeMatch) {
      env.set(composeMatch[1], resolveShellDefault(composeMatch[2]))
      continue
    }

    const yamlMatch = trimmed.match(/^([A-Z0-9_]+):\s*(.*)$/)
    if (yamlMatch) {
      env.set(yamlMatch[1], stripQuotes(yamlMatch[2]))
    }
  }
  return Object.fromEntries(env.entries())
}

function resolveShellDefault(value) {
  const required = value.match(/^\$\{[A-Z0-9_]+:\?[^}]+}$/)
  if (required) return '<required>'

  const defaulted = value.match(/^\$\{[A-Z0-9_]+:-(.*)}$/)
  if (defaulted) return stripQuotes(defaulted[1])

  return stripQuotes(value)
}

function pick(env, key) {
  const value = env[key]
  return typeof value === 'string' ? value.trim() : undefined
}

function stripQuotes(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function isBlank(value) {
  return value == null || value === ''
}

function isMissingOrExampleSecret(value, examples) {
  if (value === '<required>') return false
  if (isBlank(value)) return true
  const normalized = value.trim().toLowerCase()
  return examples.some((sample) => normalized === sample.toLowerCase())
}

function isTrue(value) {
  return value != null && /^(true|1|yes|on)$/i.test(value)
}

function isFalse(value) {
  return value != null && /^(false|0|no|off)$/i.test(value)
}

function isTemplateFile(file) {
  const normalized = file.replace(/\\/g, '/')
  return (
    normalized.endsWith('.env.example') ||
    normalized.endsWith('docker-compose.yml') ||
    normalized.endsWith('helm/ai-assistant/values.yaml')
  )
}

function getAllArgs(args, key) {
  const values = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === key && i < args.length - 1) values.push(args[i + 1])
  }
  return values
}
