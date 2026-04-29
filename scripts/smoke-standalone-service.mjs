#!/usr/bin/env node

const rawBaseUrl = process.argv[2] || process.env.AI_ASSISTANT_SMOKE_BASE_URL || 'http://localhost:8080/ai-assistant'
const accessToken = process.argv[3] ?? process.env.AI_ASSISTANT_ACCESS_TOKEN ?? ''
const timeoutMs = Number.parseInt(process.env.AI_ASSISTANT_SMOKE_TIMEOUT_MS || '5000', 10)
const maxAttempts = Number.parseInt(process.env.AI_ASSISTANT_SMOKE_ATTEMPTS || '12', 10)
const retryDelayMs = Number.parseInt(process.env.AI_ASSISTANT_SMOKE_RETRY_DELAY_MS || '2500', 10)

const baseUrl = normalizeBaseUrl(rawBaseUrl)
const serviceOrigin = new URL(baseUrl).origin

const checks = [
  {
    name: 'assistant health',
    url: `${baseUrl}/health`,
    expectedStatus: 200,
    validate: body => body?.success === true && body?.status === 'running',
  },
  {
    name: 'actuator liveness',
    url: `${serviceOrigin}/actuator/health/liveness`,
    expectedStatus: 200,
    validate: body => body?.status === 'UP',
  },
]

if (accessToken.trim()) {
  checks.push(
    {
      name: 'auth rejects missing token',
      url: `${baseUrl}/stats`,
      expectedStatus: 401,
    },
    {
      name: 'auth accepts X-AI-Token',
      url: `${baseUrl}/stats`,
      expectedStatus: 200,
      headers: { 'X-AI-Token': accessToken.trim() },
      validate: body => body && typeof body === 'object',
    },
    {
      name: 'runtime config with auth',
      url: `${baseUrl}/runtime/config`,
      expectedStatus: 200,
      headers: { 'X-AI-Token': accessToken.trim() },
      validate: validateRuntimeConfig,
    },
  )
} else {
  checks.push(
    {
      name: 'stats without auth',
      url: `${baseUrl}/stats`,
      expectedStatus: 200,
      validate: body => body && typeof body === 'object',
    },
    {
      name: 'runtime config without auth',
      url: `${baseUrl}/runtime/config`,
      expectedStatus: 200,
      validate: validateRuntimeConfig,
    },
  )
}

try {
  for (const check of checks) {
    await runCheck(check)
  }
  console.log(`Standalone service smoke test passed: ${baseUrl}`)
} catch (error) {
  console.error(`Standalone service smoke test failed: ${error.message}`)
  process.exitCode = 1
}

function normalizeBaseUrl(value) {
  if (!value || !value.trim()) {
    throw new Error('baseUrl is required')
  }
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('baseUrl must use http or https')
  }
  return url.toString().replace(/\/+$/, '')
}

async function runCheck(check) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runSingleCheck(check)
      return
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) break
      await sleep(retryDelayMs)
    }
  }
  throw lastError
}

async function runSingleCheck(check) {
  const response = await fetchWithTimeout(check.url, {
    headers: check.headers || {},
  })
  if (response.status !== check.expectedStatus) {
    const text = await response.text().catch(() => '')
    throw new Error(`${check.name} expected HTTP ${check.expectedStatus}, got ${response.status}: ${text.slice(0, 200)}`)
  }

  const body = await parseJson(response)
  if (check.validate && !check.validate(body)) {
    throw new Error(`${check.name} returned unexpected body: ${JSON.stringify(body).slice(0, 300)}`)
  }
  console.log(`ok - ${check.name}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function validateRuntimeConfig(body) {
  return body?.success === true
    && body.service
    && body.security
    && body.features
    && body.limits
    && typeof body.service.contextPath === 'string'
    && typeof body.security.accessTokenConfigured === 'boolean'
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${url} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function parseJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`expected JSON from ${response.url}, got: ${text.slice(0, 200)}`)
  }
}
