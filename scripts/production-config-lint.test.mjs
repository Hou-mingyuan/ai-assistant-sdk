import test from 'node:test'
import assert from 'node:assert/strict'

import { lintProductionConfig, parseConfigText } from './production-config-lint.mjs'

test('parseConfigText reads env, compose defaults, and yaml env values', () => {
  const env = parseConfigText(`
AI_ASSISTANT_ACCESS_TOKEN=secret
- AI_ASSISTANT_ALLOWED_ORIGINS=\${AI_ASSISTANT_ALLOWED_ORIGINS:-https://app.example.com}
- AI_ASSISTANT_API_KEY=\${AI_ASSISTANT_API_KEY:?required}
AI_ASSISTANT_MCP_SERVER_ENABLED: "true"
`)

  assert.equal(env.AI_ASSISTANT_ACCESS_TOKEN, 'secret')
  assert.equal(env.AI_ASSISTANT_ALLOWED_ORIGINS, 'https://app.example.com')
  assert.equal(env.AI_ASSISTANT_API_KEY, '<required>')
  assert.equal(env.AI_ASSISTANT_MCP_SERVER_ENABLED, 'true')
})

test('parseConfigText maps Helm chart secrets to production env keys', () => {
  const env = parseConfigText(`
secrets:
  apiKey: sk-real
  accessToken: client-token
  adminToken: admin-token
  runtimeConfigSecretKey: runtime-secret
env:
  AI_ASSISTANT_ALLOWED_ORIGINS: "https://app.example.com"
`)

  assert.equal(env.AI_ASSISTANT_API_KEY, 'sk-real')
  assert.equal(env.AI_ASSISTANT_ACCESS_TOKEN, 'client-token')
  assert.equal(env.AI_ASSISTANT_ADMIN_TOKEN, 'admin-token')
  assert.equal(env.AI_ASSISTANT_RUNTIME_CONFIG_SECRET_KEY, 'runtime-secret')
  assert.equal(env.AI_ASSISTANT_ALLOWED_ORIGINS, 'https://app.example.com')
})

test('lintProductionConfig reports high-severity public exposure risks', () => {
  const findings = lintProductionConfig(
    {
      AI_ASSISTANT_API_KEY: 'sk-real',
      AI_ASSISTANT_ACCESS_TOKEN: '',
      AI_ASSISTANT_ALLOWED_ORIGINS: '*',
      AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH: 'true',
      AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION: 'false',
    },
    { file: 'prod.env' },
  )

  assert.deepEqual(
    findings.filter((f) => f.severity === 'high').map((f) => f.rule),
    [
      'missing-access-token',
      'wide-open-cors',
      'query-token-auth',
      'ssrf-protection-disabled',
    ],
  )
})

test('lintProductionConfig downgrades template high findings to warnings', () => {
  const findings = lintProductionConfig(
    {
      AI_ASSISTANT_API_KEY: 'sk-your-key',
      AI_ASSISTANT_ACCESS_TOKEN: '',
      AI_ASSISTANT_ALLOWED_ORIGINS: '*',
    },
    { file: '.env.example', template: true },
  )

  assert.equal(findings.every((f) => f.severity !== 'high'), true)
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['missing-api-key', 'missing-access-token', 'wide-open-cors'],
  )
})

test('lintProductionConfig accepts required compose variables as production-safe', () => {
  const env = parseConfigText(`
- AI_ASSISTANT_API_KEY=\${AI_ASSISTANT_API_KEY:?AI_ASSISTANT_API_KEY is required}
- AI_ASSISTANT_ACCESS_TOKEN=\${AI_ASSISTANT_ACCESS_TOKEN:?required}
- AI_ASSISTANT_ALLOWED_ORIGINS=\${AI_ASSISTANT_ALLOWED_ORIGINS:?required}
- AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false
- AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION=true
- MANAGEMENT_INFO_ENV_ENABLED=false
`)

  assert.deepEqual(lintProductionConfig(env, { file: 'docker-compose.prod.yml' }), [])
})

test('lintProductionConfig warns when high-risk management surfaces are enabled', () => {
  const findings = lintProductionConfig(
    {
      AI_ASSISTANT_API_KEY: 'sk-real',
      AI_ASSISTANT_ACCESS_TOKEN: 'token',
      AI_ASSISTANT_ALLOWED_ORIGINS: 'https://app.example.com',
      AI_ASSISTANT_ADMIN_ENABLED: 'true',
      AI_ASSISTANT_MCP_SERVER_ENABLED: 'true',
      AI_ASSISTANT_CONNECTOR_MANAGEMENT_ENABLED: 'true',
      AI_ASSISTANT_ADMIN_TOKEN: '',
    },
    { file: 'prod.env' },
  )

  assert.deepEqual(
    findings.map((f) => f.rule),
    ['admin-token-fallback', 'mcp-enabled', 'connector-management-enabled'],
  )
  assert.equal(findings.every((f) => f.severity === 'warn'), true)
})
