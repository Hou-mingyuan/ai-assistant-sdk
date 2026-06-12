#!/usr/bin/env node

/**
 * css-token-codemod
 * -----------------
 * P3 of the design-token plan: rewrite literal color values in a component CSS
 * file to `var(--ai-c-*)` primitive references. Only literals whose normalized
 * value EXACTLY matches a known primitive are rewritten, so every replacement is
 * a zero-visual-change refactor (the var resolves to the identical value).
 *
 * Safety:
 *  - Matches whole color tokens via regex, so `#fff` vs `#ffffff` never overlap.
 *  - Unknown colors (no exact token) are left untouched.
 *  - Idempotent: `var(...)` output is not re-matched.
 *  - NEVER run on 00-enterprise-tokens.css (would make primitives reference
 *    themselves) or on body-teleported scopes where `--ai-c-*` is out of scope
 *    (e.g. .ai-cite-card). The CLI guards against the tokens file.
 *
 * Usage:
 *   node scripts/css-token-codemod.mjs --file <path.css> [--check]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* normalized color value -> primitive token name (mirrors 00-enterprise-tokens.css) */
export const COLOR_TOKEN_MAP = {
  '#ffffff': '--ai-c-white',
  '#f7f7f9': '--ai-c-gray-50',
  '#f4f5f9': '--ai-c-gray-75',
  '#f0f1f5': '--ai-c-gray-100',
  '#e7e8ee': '--ai-c-gray-200',
  '#94a3b8': '--ai-c-slate-400',
  '#475569': '--ai-c-slate-600',
  '#0f172a': '--ai-c-slate-900',
  'rgba(15,23,42,0.04)': '--ai-c-slate-a04',
  'rgba(15,23,42,0.06)': '--ai-c-slate-a06',
  'rgba(15,23,42,0.07)': '--ai-c-slate-a07',
  'rgba(15,23,42,0.08)': '--ai-c-slate-a08',
  'rgba(15,23,42,0.14)': '--ai-c-slate-a14',
  'rgba(15,23,42,0.24)': '--ai-c-slate-a24',
  '#4f46e5': '--ai-c-indigo-600',
  '#4338ca': '--ai-c-indigo-700',
  'rgba(79,70,229,0.06)': '--ai-c-indigo-a06',
  'rgba(79,70,229,0.12)': '--ai-c-indigo-a12',
  'rgba(79,70,229,0.32)': '--ai-c-indigo-a32',
  '#7c3aed': '--ai-c-violet-600',
  '#f0eaff': '--ai-c-violet-50',
  '#06b6d4': '--ai-c-cyan-500',
  '#10b981': '--ai-c-emerald-500',
  '#f59e0b': '--ai-c-amber-500',
  '#ef4444': '--ai-c-red-500',
  '#3b82f6': '--ai-c-blue-500',
  '#f5f5f7': '--ai-c-ink-50',
  '#a3a3a8': '--ai-c-ink-300',
  '#6b6b73': '--ai-c-ink-500',
  '#25262f': '--ai-c-ink-700',
  '#1c1d26': '--ai-c-ink-800',
  '#14151c': '--ai-c-ink-850',
  '#0e0f15': '--ai-c-ink-900',
  '#0a0b10': '--ai-c-ink-950',
  '#0a0a0c': '--ai-c-ink-980',
  'rgba(255,255,255,0.04)': '--ai-c-white-a04',
  'rgba(255,255,255,0.06)': '--ai-c-white-a06',
  'rgba(255,255,255,0.08)': '--ai-c-white-a08',
  'rgba(255,255,255,0.14)': '--ai-c-white-a14',
  'rgba(255,255,255,0.22)': '--ai-c-white-a22',
  'rgba(91,108,255,0.08)': '--ai-c-brand-a08',
  'rgba(91,108,255,0.18)': '--ai-c-brand-a18',
  'rgba(91,108,255,0.45)': '--ai-c-brand-a45',
}

export function normalizeColor(raw) {
  const s = raw.trim().toLowerCase()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      return '#' + hex.split('').map((c) => c + c).join('')
    }
    return '#' + hex
  }
  if (s.startsWith('rgb')) {
    return s.replace(/\s+/g, '')
  }
  return s
}

export function codemodCss(text) {
  let replaced = 0
  let out = text.replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => {
    const token = COLOR_TOKEN_MAP[normalizeColor(m)]
    if (token) {
      replaced++
      return `var(${token})`
    }
    return m
  })
  out = out.replace(/rgba?\([^)]*\)/gi, (m) => {
    const token = COLOR_TOKEN_MAP[normalizeColor(m)]
    if (token) {
      replaced++
      return `var(${token})`
    }
    return m
  })
  return { out, replaced }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}

function runCli() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const fileIdx = args.indexOf('--file')
  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('usage: css-token-codemod.mjs --file <path.css> [--check]')
    process.exit(2)
  }
  const rel = args[fileIdx + 1]
  if (/00-enterprise-tokens\.css$/.test(rel)) {
    console.error('refusing to run on 00-enterprise-tokens.css (would create self-referential tokens)')
    process.exit(2)
  }
  const abs = path.isAbsolute(rel) ? rel : path.join(root, rel)
  const text = readFileSync(abs, 'utf8')
  const { out, replaced } = codemodCss(text)
  if (check) {
    console.log(`css-token-codemod (dry-run): ${replaced} literal color(s) would map to tokens in ${rel}`)
    return
  }
  if (replaced === 0) {
    console.log(`css-token-codemod: no convertible literals in ${rel}`)
    return
  }
  writeFileSync(abs, out)
  console.log(`css-token-codemod: rewrote ${replaced} literal color(s) to var(--ai-c-*) in ${rel}`)
}
