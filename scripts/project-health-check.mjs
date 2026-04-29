#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const runDocs = args.has('--docs') || args.has('--all')
const runUiTests = args.has('--ui-test') || args.has('--all')
const runServerTests = args.has('--server-test') || args.has('--all')

const checks = [
  {
    name: '版本一致性',
    command: process.execPath,
    args: [path.join(root, 'scripts/check-version-consistency.mjs')],
    cwd: root,
  },
]

if (runDocs) {
  checks.push({
    name: '文档站构建',
    command: npmCommand(),
    args: ['run', 'build'],
    cwd: path.join(root, 'docs'),
  })
}

if (runUiTests) {
  checks.push({
    name: '前端单元测试',
    command: npmCommand(),
    args: ['test'],
    cwd: path.join(root, 'ai-assistant-ui'),
  })
}

if (runServerTests) {
  checks.push({
    name: '后端单元测试',
    command: mavenCommand(),
    args: ['test'],
    cwd: path.join(root, 'ai-assistant-server'),
  })
}

console.log('AI Assistant SDK health check')
console.log(`Project root: ${root}`)
console.log('')

for (const check of checks) {
  console.log(`▶ ${check.name}`)
  const result = runCommand(check.command, check.args, check.cwd)

  if (result.error) {
    console.error(`✗ ${check.name} failed to start: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`✗ ${check.name} failed with exit code ${result.status}`)
    process.exit(result.status ?? 1)
  }

  console.log(`✓ ${check.name}`)
  console.log('')
}

if (!runDocs && !runUiTests && !runServerTests) {
  console.log('Tip: add --docs, --ui-test, --server-test, or --all to run more checks.')
}

console.log('Health check passed.')

function npmCommand() {
  return 'npm'
}

function mavenCommand() {
  return 'mvn'
}

function runCommand(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}
