import { readFile } from 'node:fs/promises'

const DEFAULT_DEMO_WEB_PORT = '3000'

/**
 * Resolve the externally reachable demo origin without requiring callers to
 * duplicate values already stored in the ignored root .env file.
 */
export async function resolveDemoWebOrigin({
  env = process.env,
  envFile = new URL('../.env', import.meta.url),
} = {}) {
  const explicitOrigin = String(env.AI_ASSISTANT_DEMO_WEB_ORIGIN ?? '').trim()
  if (explicitOrigin) return explicitOrigin.replace(/\/+$/, '')

  const processPort = normalizePort(env.AI_ASSISTANT_WEB_PORT)
  if (processPort) return `http://localhost:${processPort}`

  const envFilePort = normalizePort(await readEnvValue(envFile, 'AI_ASSISTANT_WEB_PORT'))
  return `http://localhost:${envFilePort || DEFAULT_DEMO_WEB_PORT}`
}

async function readEnvValue(envFile, key) {
  let source
  try {
    source = await readFile(envFile, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 1 || line.slice(0, separator).trim() !== key) continue

    const rawValue = line
      .slice(separator + 1)
      .replace(/\s+#.*$/, '')
      .trim()
    if (
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")))
    ) {
      return rawValue.slice(1, -1).trim()
    }
    return rawValue
  }
  return ''
}

function normalizePort(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return ''
  const port = Number(text)
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? String(port) : ''
}
