#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const runDocs = args.has('--docs') || args.has('--all')
const runUiTests = args.has('--ui-test') || args.has('--all')
const runServerTests = args.has('--server-test') || args.has('--all')
const runPlaygroundBuild = args.has('--playground-build') || args.has('--all')
const runE2eTests = args.has('--e2e') || args.has('--all')

const checks = [
  {
    name: 'version consistency',
    command: process.execPath,
    args: [path.join(root, 'scripts/check-version-consistency.mjs')],
    cwd: root,
  },
]

if (runDocs) {
  checks.push({
    name: 'docs build',
    command: npmCommand(),
    args: ['run', 'build'],
    cwd: path.join(root, 'docs'),
  })
}

if (runUiTests) {
  checks.push({
    name: 'frontend unit tests',
    command: npmCommand(),
    args: ['test'],
    cwd: path.join(root, 'ai-assistant-ui'),
  })
}

if (runServerTests) {
  checks.push({
    name: 'backend unit tests',
    command: mavenCommand(),
    args: ['test'],
    cwd: path.join(root, 'ai-assistant-server'),
  })
}

if (runPlaygroundBuild) {
  checks.push({
    name: 'playground build',
    command: npmCommand(),
    args: ['run', 'build'],
    cwd: path.join(root, 'ai-assistant-vue-playground'),
  })
}

if (runE2eTests) {
  checks.push({
    name: 'e2e smoke tests',
    command: npmCommand(),
    args: ['test'],
    cwd: path.join(root, 'e2e'),
  })
}

console.log('AI Assistant SDK health check')
console.log(`Project root: ${root}`)
console.log('')

for (const check of checks) {
  console.log(`> ${check.name}`)
  const result = runCommand(check.command, check.args, check.cwd)

  if (result.error) {
    console.error(`FAIL ${check.name} failed to start: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`FAIL ${check.name} failed with exit code ${result.status}`)
    process.exit(result.status ?? 1)
  }

  console.log(`OK ${check.name}`)
  console.log('')
}

if (!runDocs && !runUiTests && !runServerTests && !runPlaygroundBuild && !runE2eTests) {
  console.log(
    'Tip: add --docs, --ui-test, --server-test, --playground-build, --e2e, or --all to run more checks.',
  )
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
