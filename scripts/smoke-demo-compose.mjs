#!/usr/bin/env node
/**
 * Smoke test for docker-compose.demo.yml (web on :3000, backend proxied at /ai-assistant).
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const webOrigin = (process.env.AI_ASSISTANT_DEMO_WEB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '')
const zeroKeyScript = fileURLToPath(new URL('./smoke-zero-key.mjs', import.meta.url))
const timeoutMs = Number.parseInt(process.env.AI_ASSISTANT_SMOKE_TIMEOUT_MS || '5000', 10)
const maxAttempts = Number.parseInt(process.env.AI_ASSISTANT_SMOKE_ATTEMPTS || '12', 10)
const retryDelayMs = Number.parseInt(process.env.AI_ASSISTANT_SMOKE_RETRY_DELAY_MS || '2500', 10)

try {
  await runCheck({
    name: 'demo web home',
    url: `${webOrigin}/`,
    expectedStatus: 200,
  })

  await runZeroKeySmoke(`${webOrigin}/ai-assistant`)
  console.log(`Demo compose smoke passed: ${webOrigin}`)
} catch (error) {
  console.error(`Demo compose smoke failed: ${error.message}`)
  process.exitCode = 1
}

function runZeroKeySmoke(baseUrl) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [zeroKeyScript, baseUrl], {
      stdio: 'inherit',
      env: process.env,
    })
    proc.on('error', reject)
    proc.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`smoke-zero-key exited with code ${code}`))
    })
  })
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
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(check.url, { signal: controller.signal })
    if (response.status !== check.expectedStatus) {
      throw new Error(`${check.name} expected HTTP ${check.expectedStatus}, got ${response.status}`)
    }
    console.log(`ok - ${check.name}`)
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
