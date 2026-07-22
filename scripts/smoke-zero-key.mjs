#!/usr/bin/env node
/**
 * Zero-key demo smoke: health, runtime probes, blocking chat, and SSE streaming without an
 * external provider key. The service must explicitly report the deterministic demo provider;
 * fixed output is never accepted as a live AI response.
 */
const rawBaseUrl = process.argv[2] || process.env.AI_ASSISTANT_SMOKE_BASE_URL || 'http://localhost:8080/ai-assistant'
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
    validate: body => body?.success === true
      && body?.status === 'running'
      && body?.provider === 'demo'
      && body?.mode === 'demo'
      && body?.mock === true,
  },
  {
    name: 'actuator liveness',
    url: `${serviceOrigin}/actuator/health/liveness`,
    expectedStatus: 200,
    validate: body => body?.status === 'UP',
  },
  {
    name: 'actuator readiness',
    url: `${serviceOrigin}/actuator/health/readiness`,
    expectedStatus: 200,
    validate: body => body?.status === 'UP',
  },
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
  {
    name: 'explicit demo provider health',
    url: `${baseUrl}/health/provider`,
    expectedStatus: 200,
    validate: body => body?.status === 'UP'
      && body?.provider === 'demo'
      && body?.mode === 'demo'
      && body?.mock === true,
  },
  {
    name: 'deterministic demo chat pipeline',
    method: 'POST',
    url: `${baseUrl}/chat`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'ping from zero-key smoke', action: 'chat' }),
    expectedStatus: 200,
    validate: body => body?.success === true
      && body?.result?.includes('[DEMO MODE - deterministic local response, not real AI]')
      && body?.result?.includes('ping from zero-key smoke')
      && body?.meta?.provider === 'demo',
  },
  {
    name: 'deterministic demo SSE pipeline',
    method: 'POST',
    url: `${baseUrl}/stream`,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ text: 'stream from zero-key smoke', action: 'chat' }),
    expectedStatus: 200,
    expectedContentType: 'text/event-stream',
    responseType: 'text',
    validate: body => body.includes('[DEMO MODE - deterministic local response, not real AI]')
      && body.includes('stream from zero-key smoke'),
  },
]

try {
  for (const check of checks) {
    await runCheck(check)
  }
  console.log(`Zero-key demo smoke passed: ${baseUrl}`)
} catch (error) {
  console.error(`Zero-key demo smoke failed: ${error.message}`)
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
    method: check.method || 'GET',
    headers: check.headers || {},
    body: check.body,
  })
  if (response.status !== check.expectedStatus) {
    const text = await response.text().catch(() => '')
    throw new Error(`${check.name} expected HTTP ${check.expectedStatus}, got ${response.status}: ${text.slice(0, 200)}`)
  }

  if (check.expectedContentType) {
    const actualContentType = response.headers.get('content-type') || ''
    if (!actualContentType.toLowerCase().includes(check.expectedContentType.toLowerCase())) {
      throw new Error(`${check.name} expected Content-Type ${check.expectedContentType}, got ${actualContentType || '<missing>'}`)
    }
  }

  const body = check.responseType === 'text' ? await response.text() : await parseJson(response)
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
    && body.service.mode === 'demo'
    && body.service.mockProvider === true
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
