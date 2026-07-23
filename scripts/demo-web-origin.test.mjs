import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveDemoWebOrigin } from './demo-web-origin.mjs'

test('explicit demo origin takes precedence and drops trailing slashes', async () => {
  const origin = await resolveDemoWebOrigin({
    env: {
      AI_ASSISTANT_DEMO_WEB_ORIGIN: 'http://127.0.0.1:19012///',
      AI_ASSISTANT_WEB_PORT: '19011',
    },
    envFile: join(tmpdir(), 'missing-ai-assistant-env'),
  })

  assert.equal(origin, 'http://127.0.0.1:19012')
})

test('process web port takes precedence over the ignored env file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-assistant-origin-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const envFile = join(directory, '.env')
  await writeFile(envFile, 'AI_ASSISTANT_WEB_PORT=19010\n', 'utf8')

  const origin = await resolveDemoWebOrigin({
    env: { AI_ASSISTANT_WEB_PORT: '19011' },
    envFile,
  })

  assert.equal(origin, 'http://localhost:19011')
})

test('ignored env file controls the demo smoke port', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-assistant-origin-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const envFile = join(directory, '.env')
  await writeFile(
    envFile,
    ['# local parallel override', 'AI_ASSISTANT_WEB_PORT="19010" # host only', ''].join('\n'),
    'utf8',
  )

  const origin = await resolveDemoWebOrigin({ env: {}, envFile })

  assert.equal(origin, 'http://localhost:19010')
})

test('missing or invalid local port safely falls back to 3000', async () => {
  assert.equal(
    await resolveDemoWebOrigin({
      env: { AI_ASSISTANT_WEB_PORT: '70000' },
      envFile: join(tmpdir(), 'missing-ai-assistant-env'),
    }),
    'http://localhost:3000',
  )
})

test('origin CLI prints the resolved process port for launch scripts', () => {
  const result = spawnSync(process.execPath, ['scripts/print-demo-web-origin.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      AI_ASSISTANT_DEMO_WEB_ORIGIN: '',
      AI_ASSISTANT_WEB_PORT: '19010',
    },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'http://localhost:19010')
})
