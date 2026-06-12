#!/usr/bin/env node

/**
 * css-budget-check
 * ----------------
 * Ratchet guard that freezes the `!important` CSS debt. The total `!important`
 * count across the widget stylesheet suite must not exceed the committed
 * baseline. Removing or relocating `!important` is always allowed; only net
 * increases fail.
 *
 * Pairs with the CSS debt cleanup plan (P1 "freeze increment"). After an
 * intentional reduction, run with `--update-baseline` to ratchet the ceiling
 * down so the new, lower number becomes the cap.
 *
 * Pure helpers are exported for unit testing; the CLI runs only when invoked
 * directly (mirrors dependency-footprint-check.mjs).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STYLES_DIR = path.join(root, 'ai-assistant-ui/src/components/styles')
const BASELINE_PATH = path.join(root, 'scripts/.css-budget-baseline.json')

/* CSS allows whitespace between the bang and the keyword: `! important`. */
const IMPORTANT_RE = /!\s*important/gi

export function countImportant(cssText) {
  // Strip CSS block comments first: `!important` only has meaning in real
  // declarations, so comments that merely mention the word (e.g. a note saying
  // "no !important here") must not count against the budget.
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const matches = withoutComments.match(IMPORTANT_RE)
  return matches ? matches.length : 0
}

export function computeBudget(files) {
  const perFile = {}
  let total = 0
  for (const file of files) {
    const count = countImportant(file.text)
    perFile[file.name] = count
    total += count
  }
  return { total, perFile }
}

export function evaluateBudget(current, baseline) {
  const findings = []
  if (!baseline) {
    findings.push({
      severity: 'warn',
      rule: 'no-baseline',
      message: 'no CSS budget baseline found; run with --update-baseline to create one',
    })
    return findings
  }
  if (current.total > baseline.total) {
    findings.push({
      severity: 'high',
      rule: 'important-increase',
      message:
        `!important count increased: ${baseline.total} -> ${current.total} ` +
        `(+${current.total - baseline.total}). Reuse tokens / @layer instead of !important; ` +
        'run --update-baseline only when intentionally lowering the ceiling.',
    })
  }
  return findings
}

export function diffPerFile(current, baseline) {
  const changes = []
  const names = new Set([
    ...Object.keys(baseline?.perFile ?? {}),
    ...Object.keys(current.perFile),
  ])
  for (const name of [...names].sort()) {
    const before = baseline?.perFile?.[name] ?? 0
    const after = current.perFile[name] ?? 0
    if (before !== after) changes.push({ name, before, after })
  }
  return changes
}

function readStyleFiles() {
  return readdirSync(STYLES_DIR)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => ({ name, text: readFileSync(path.join(STYLES_DIR, name), 'utf8') }))
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}

function runCli() {
  const args = new Set(process.argv.slice(2))
  const current = computeBudget(readStyleFiles())

  if (args.has('--update-baseline')) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n')
    console.log(`css-budget-check: baseline updated (total !important = ${current.total})`)
    return
  }

  const baseline = readBaseline()
  if (baseline) {
    console.log(
      `css-budget-check: total !important ${baseline.total} (baseline) -> ${current.total} (current)`,
    )
    const changes = diffPerFile(current, baseline)
    if (changes.length > 0) {
      console.log('per-file changes:')
      for (const c of changes) console.log(`  ${c.name}: ${c.before} -> ${c.after}`)
    }
  }

  const findings = evaluateBudget(current, baseline)
  for (const finding of findings) {
    const log = finding.severity === 'high' ? console.error : console.warn
    log(`[${finding.severity.toUpperCase()}] ${finding.rule}: ${finding.message}`)
  }

  if (findings.some((f) => f.severity === 'high')) process.exit(1)
  console.log('css-budget-check: OK (no !important increase)')
}
