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
/* I4: 集成 F2 bundle-size-check 作为可选 lane。需要 ai-assistant-ui/dist 已构建 */
const runBundleSize = args.has('--bundle') || args.has('--all')
/* J2: 集成 coverage-check 作为可选 lane。--all 时会先跑 test:coverage 生成 summary */
const runCoverage = args.has('--coverage') || args.has('--all')
/* K1: 多实例配置 lint：扫 .env / compose / helm 检查 in-process state 与 replicas>1 冲突 */
const runMultiReplica = args.has('--multi-replica') || args.has('--all')
/* K2: SSRF allowlist policy 单元测试（轻量，复用 ai-assistant-server JUnit） */
const runSsrfTest = args.has('--ssrf') || args.has('--all')

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

if (runBundleSize) {
  /* --all 时 build:lib 先做以保证 dist 是最新；单独 --bundle 时假设 dist 已存在 */
  if (args.has('--all')) {
    checks.push({
      name: 'frontend build:lib (for bundle-size baseline)',
      command: npmCommand(),
      args: ['run', 'build:lib'],
      cwd: path.join(root, 'ai-assistant-ui'),
    })
  }
  checks.push({
    name: 'bundle size watchdog',
    command: process.execPath,
    args: [path.join(root, 'scripts/bundle-size-check.mjs'), '--max-delta-percent', '10'],
    cwd: root,
  })
}

if (runCoverage) {
  /* --all 时跑 test:coverage 先生成 summary；单独 --coverage 假设已生成 */
  if (args.has('--all')) {
    checks.push({
      name: 'frontend test:coverage (for coverage-check)',
      command: npmCommand(),
      args: ['run', 'test:coverage'],
      cwd: path.join(root, 'ai-assistant-ui'),
    })
  }
  checks.push({
    name: 'coverage regression check',
    command: process.execPath,
    args: [path.join(root, 'scripts/coverage-check.mjs'), '--max-drop-percent', '1.0'],
    cwd: root,
  })
}

if (runMultiReplica) {
  /* K1: 扫描配置文件，对「多实例 + 进程内状态」组合给出 warn/high finding；
   * --strict 时高严重度阻塞 CI，本地默认仅 warn */
  const strictFlag = args.has('--strict') ? ['--strict'] : []
  checks.push({
    name: 'multi-replica config lint',
    command: process.execPath,
    args: [path.join(root, 'scripts/multi-replica-config-lint.mjs'), ...strictFlag],
    cwd: root,
  })
}

if (runSsrfTest) {
  /* K2: 仅跑 SSRF 相关单测，避免完整 mvn test 几分钟级耗时 */
  checks.push({
    name: 'SSRF policy unit tests (allowlist + default)',
    command: mavenCommand(),
    args: [
      'test',
      '-Dtest=AllowlistSsrfPolicyTest',
      '-Dspotless.check.skip=true',
      '-Dcheckstyle.skip=true',
      '-Djacoco.skip=true',
    ],
    cwd: path.join(root, 'ai-assistant-server'),
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

if (
  !runDocs &&
  !runUiTests &&
  !runServerTests &&
  !runPlaygroundBuild &&
  !runE2eTests &&
  !runBundleSize &&
  !runCoverage &&
  !runMultiReplica &&
  !runSsrfTest
) {
  console.log(
    'Tip: add --docs, --ui-test, --server-test, --playground-build, --e2e, --bundle, --coverage, --multi-replica, --ssrf, or --all to run more checks.',
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
