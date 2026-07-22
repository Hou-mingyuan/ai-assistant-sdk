#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const e2eDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(e2eDir, '..')
const backendOrigin = new URL(
  process.env.AI_ASSISTANT_E2E_BACKEND_ORIGIN || 'http://127.0.0.1:8080',
)
const port = backendOrigin.port || (backendOrigin.protocol === 'https:' ? '443' : '80')
const maven = process.platform === 'win32' ? 'mvn.cmd' : 'mvn'

const build = spawnSync(
  maven,
  [
    '-q',
    '-pl',
    'ai-assistant-demo',
    '-am',
    '-Dtest=StarterDemoIntegrationTest',
    '-Dsurefire.failIfNoSpecifiedTests=false',
    'package',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

if (build.error) {
  console.error(`Unable to start Maven: ${build.error.message}`)
  process.exit(1)
}
if (build.status !== 0) process.exit(build.status ?? 1)

const targetDir = path.join(root, 'ai-assistant-demo', 'target')
const jar = readdirSync(targetDir)
  .filter((name) => /^ai-assistant-demo-.+\.jar$/.test(name))
  .map((name) => ({ name, mtimeMs: statSync(path.join(targetDir, name)).mtimeMs }))
  .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.name

if (!jar) {
  console.error(`Starter Demo executable JAR was not found in ${targetDir}`)
  process.exit(1)
}

const server = spawn('java', ['-jar', path.join(targetDir, jar), `--server.port=${port}`], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    AI_ASSISTANT_PROVIDER: 'demo',
    AI_ASSISTANT_API_KEY: '',
  },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal))
}

server.on('error', (error) => {
  console.error(`Unable to start Starter Demo: ${error.message}`)
  process.exit(1)
})
server.on('exit', (code) => process.exit(code ?? 0))
