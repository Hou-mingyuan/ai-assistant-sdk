#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CI_METRICS_COMMENT_MARKER = '<!-- ci-metrics-sticky -->'
export const CI_METRICS_REPORT_ORDER = ['bundle', 'coverage', 'supportDependencies']

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2))
  const body = buildCiMetricsComment({
    bundleMarkdown: readFileSync(path.resolve(root, args.bundle), 'utf8'),
    coverageMarkdown: readFileSync(path.resolve(root, args.coverage), 'utf8'),
    supportDependenciesMarkdown: readFileSync(path.resolve(root, args.supportDependencies), 'utf8'),
    runUrl: args.runUrl,
    runNumber: args.runNumber,
  })

  writeFileSync(path.resolve(root, args.out), body, 'utf8')
}

export function buildCiMetricsComment({
  bundleMarkdown,
  coverageMarkdown,
  supportDependenciesMarkdown,
  runUrl,
  runNumber,
}) {
  const sections = {
    bundle: bundleMarkdown,
    coverage: coverageMarkdown,
    supportDependencies: supportDependenciesMarkdown,
  }
  return [
    CI_METRICS_COMMENT_MARKER,
    ...CI_METRICS_REPORT_ORDER.flatMap((key) => [trimTrailingNewline(sections[key]), '']),
    formatCiMetricsFooter({ runUrl, runNumber }),
    '',
  ].join('\n')
}

export function formatCiMetricsFooter({ runUrl, runNumber }) {
  return `<sub>Updated by [CI workflow](${runUrl}) · run #${runNumber}.</sub>`
}

function parseArgs(argv) {
  const out = {
    bundle: '.ci-reports/bundle.md',
    coverage: '.ci-reports/coverage.md',
    supportDependencies: '.ci-reports/support-dependencies.md',
    out: '.ci-reports/combined.md',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--bundle') out.bundle = argv[++i]
    else if (arg === '--coverage') out.coverage = argv[++i]
    else if (arg === '--support-dependencies') out.supportDependencies = argv[++i]
    else if (arg === '--out') out.out = argv[++i]
    else if (arg === '--run-url') out.runUrl = argv[++i]
    else if (arg === '--run-number') out.runNumber = argv[++i]
  }

  if (!out.runUrl || !out.runNumber) {
    throw new Error('ci-metrics-comment requires --run-url and --run-number')
  }
  return out
}

function trimTrailingNewline(value) {
  return value.replace(/\s+$/u, '')
}
