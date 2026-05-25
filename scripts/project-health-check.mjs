#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const localVerifyRuntimeConfigPath = `target/runtime-model-config-local-verify-${process.pid}.properties`
const runReleaseCheck = args.has('--release-check')
const runReleaseCheckFast = args.has('--release-check-fast')
const runReleaseCheckFull = args.has('--release-check-full') || runReleaseCheck
const runReleaseChecks = runReleaseCheckFast || runReleaseCheckFull
const runLocalVerify = args.has('--local-verify')
const runDocs = args.has('--docs') || args.has('--all')
const runUiTests = args.has('--ui-test') || args.has('--all')
const runServerTests = args.has('--server-test') || args.has('--all')
const runPlaygroundBuild = args.has('--playground-build') || args.has('--all')
const runE2eTests = args.has('--e2e') || args.has('--all')
/* I4/K63: bundle-size-check 作为可选 lane；release-check 会在已构建 dist 上输出变化摘要 */
const runBundleSize = args.has('--bundle') || runReleaseCheckFull || args.has('--all')
/* J2: 集成 coverage-check 作为可选 lane。--all 时会先跑 test:coverage 生成 summary */
const runCoverage = args.has('--coverage') || args.has('--all')
/* K1: 多实例配置 lint：扫 .env / compose / helm 检查 in-process state 与 replicas>1 冲突 */
const runMultiReplica = args.has('--multi-replica') || args.has('--all')
/* K58: 生产安全基线 lint：检查 token/CORS/SSRF/Admin/MCP 等高风险配置 */
const runProdConfig = args.has('--prod-config') || args.has('--all')
/* K2: SSRF allowlist policy 单元测试（轻量，复用 ai-assistant-server JUnit） */
const runSsrfTest = args.has('--ssrf') || args.has('--all')
/* K59: 行尾噪音检查：只读地区分真实内容差异与 CRLF/LF-only diff */
const runLineEndings = args.has('--line-endings') || args.has('--all')
/* K60: Starter 依赖足迹策略检查：防止 optional 能力退化为默认依赖 */
const runDependencyFootprint =
  args.has('--dependency-footprint') || runReleaseChecks || args.has('--all')
const runSupportDependencyReport =
  args.has('--support-dependency-report') || runReleaseChecks || args.has('--all')
/* K61: 包体归因报告：基于 bundle-size baseline 输出 main / wc / chunk 构成 */
const runBundleComposition = args.has('--bundle-composition') || runReleaseCheckFull || args.has('--all')
/* K62: 仓库脚本单测 + 静态 OpenAPI 类型检查，作为 release-check 的轻量核心 */
const runScriptTests = args.has('--script-test') || runReleaseChecks || args.has('--all')
const runOpenApiTypes = args.has('--openapi-types') || runReleaseChecks || args.has('--all')
const runOpenApiRefresh = args.has('--openapi-refresh') || runReleaseChecks || args.has('--all')

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

if (runScriptTests) {
  checks.push({
    name: 'repo script tests',
    command: process.execPath,
    args: ['--test', path.join(root, 'scripts/*.test.mjs')],
    cwd: root,
  })
}

if (runOpenApiTypes) {
  checks.push({
    name: 'static OpenAPI generated type check',
    command: process.execPath,
    args: [
      path.join(root, 'scripts/generate-frontend-types.mjs'),
      '--spec-file',
      path.join(root, 'docs/api/openapi.json'),
      '--check',
    ],
    cwd: root,
  })
}

if (runOpenApiRefresh) {
  checks.push({
    name: 'static OpenAPI snapshot refresh dry-run',
    command: process.execPath,
    args: [
      path.join(root, 'scripts/refresh-openapi-snapshot.mjs'),
      '--spec-file',
      path.join(root, 'docs/api/openapi.json'),
      '--check',
      '--skip-types',
    ],
    cwd: root,
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

if (runLocalVerify) {
  checks.push(
    {
      name: 'frontend unit tests (local verify)',
      command: npmCommand(),
      args: ['test'],
      cwd: path.join(root, 'ai-assistant-ui'),
    },
    {
      name: 'frontend build (local verify)',
      command: npmCommand(),
      args: ['run', 'build'],
      cwd: path.join(root, 'ai-assistant-ui'),
    },
    {
      name: 'backend unit tests (local verify)',
      command: mavenCommand(),
      args: [
        'test',
        '-Dspotless.check.skip=true',
        '-Dcheckstyle.skip=true',
        '-Djacoco.skip=true',
        `-Dai.assistant.runtime.config.path=${localVerifyRuntimeConfigPath}`,
      ],
      cwd: path.join(root, 'ai-assistant-server'),
    },
    {
      name: 'backend service package (local verify)',
      command: mavenCommand(),
      args: ['-pl', 'ai-assistant-service', '-am', '-DskipTests', 'package'],
      cwd: root,
    },
  )
}

if (runBundleSize) {
  if (runReleaseCheckFull) {
    checks.push({
      name: 'frontend build (for release-check bundle baseline)',
      command: npmCommand(),
      args: ['run', 'build'],
      cwd: path.join(root, 'ai-assistant-ui'),
    })
  } else if (args.has('--all')) {
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

if (runProdConfig) {
  const strictFlag = args.has('--strict') ? ['--strict'] : []
  checks.push({
    name: 'production config lint',
    command: process.execPath,
    args: [path.join(root, 'scripts/production-config-lint.mjs'), ...strictFlag],
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

if (runLineEndings) {
  checks.push({
    name: 'line-ending noise check',
    command: process.execPath,
    args: [path.join(root, 'scripts/line-ending-noise-check.mjs')],
    cwd: root,
  })
}

if (runDependencyFootprint) {
  checks.push({
    name: 'dependency footprint policy check',
    command: process.execPath,
    args: [path.join(root, 'scripts/dependency-footprint-check.mjs')],
    cwd: root,
  })
}

if (runSupportDependencyReport) {
  checks.push({
    name: 'support dependency boundary report',
    command: process.execPath,
    args: [path.join(root, 'scripts/support-dependency-report.mjs')],
    cwd: root,
  })
}

if (runBundleComposition) {
  checks.push({
    name: 'bundle composition report',
    command: process.execPath,
    args: [path.join(root, 'scripts/bundle-composition-report.mjs')],
    cwd: root,
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
  !runReleaseCheck &&
  !runReleaseCheckFast &&
  !runReleaseCheckFull &&
  !runLocalVerify &&
  !runUiTests &&
  !runServerTests &&
  !runPlaygroundBuild &&
  !runE2eTests &&
  !runBundleSize &&
  !runCoverage &&
  !runMultiReplica &&
  !runProdConfig &&
  !runSsrfTest &&
  !runLineEndings &&
  !runDependencyFootprint &&
  !runSupportDependencyReport &&
  !runBundleComposition &&
  !runScriptTests &&
  !runOpenApiTypes
) {
  console.log(
    'Tip: add --docs, --ui-test, --server-test, --playground-build, --e2e, --bundle, --coverage, --multi-replica, --prod-config, --ssrf, --line-endings, --dependency-footprint, --support-dependency-report, --bundle-composition, --script-test, --openapi-types, --openapi-refresh, --local-verify, --release-check-fast, --release-check-full, --release-check, or --all to run more checks.',
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
