#!/usr/bin/env node

/**
 * line-ending-noise-check
 * -----------------------
 * Read-only helper that separates real git content changes from CRLF/LF-only
 * noise. It does not normalize files, update the index, or modify the working
 * tree.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2))
}

function runCli(argv) {
  const failOnContent = argv.includes('--fail-on-content')
  const failOnEol = argv.includes('--fail-on-eol')

  const status = collectGitNames(['status', '--porcelain', '--untracked-files=no'], {
    parser: parsePorcelainNames,
  })
  const unstaged = collectGitNames(['diff', '--name-only'])
  const unstagedIgnoringEol = collectGitNames([
    'diff',
    '--name-only',
    '--ignore-space-at-eol',
  ])
  const staged = collectGitNames(['diff', '--cached', '--name-only'])
  const stagedIgnoringEol = collectGitNames([
    'diff',
    '--cached',
    '--name-only',
    '--ignore-space-at-eol',
  ])

  const result = summarizeLineEndingNoise({
    status,
    unstaged,
    unstagedIgnoringEol,
    staged,
    stagedIgnoringEol,
  })

  printSection('line-ending-noise-check')
  printFileList('content diffs', result.contentDiffs)
  printFileList('line-ending-only diffs', result.lineEndingOnlyDiffs)

  if (result.contentDiffs.length === 0 && result.lineEndingOnlyDiffs.length === 0) {
    console.log('No tracked content diffs or line-ending-only diffs found.')
  } else if (result.contentDiffs.length === 0) {
    console.log(
      'Only line-ending-only tracked diffs were detected. Keep them isolated from feature work.',
    )
  }

  if (failOnContent && result.contentDiffs.length > 0) {
    console.error('fail-on-content: content diffs present')
    process.exit(1)
  }
  if (failOnEol && result.lineEndingOnlyDiffs.length > 0) {
    console.error('fail-on-eol: line-ending-only diffs present')
    process.exit(1)
  }
}

export function summarizeLineEndingNoise({
  status = [],
  unstaged,
  unstagedIgnoringEol,
  staged = [],
  stagedIgnoringEol = [],
}) {
  const statusNames = normalizeNames(status)
  const allPatchNames = normalizeNames([...unstaged, ...staged])
  const contentDiffs = normalizeNames([...unstagedIgnoringEol, ...stagedIgnoringEol])
  const contentSet = new Set(contentDiffs)
  const trackedChangeNames = statusNames.length > 0 ? statusNames : allPatchNames
  return {
    contentDiffs,
    lineEndingOnlyDiffs: trackedChangeNames.filter((name) => !contentSet.has(name)),
  }
}

export function classifyDiffNames(diffNames, diffNamesIgnoringEol) {
  const all = normalizeNames(diffNames)
  const content = normalizeNames(diffNamesIgnoringEol)
  const contentSet = new Set(content)
  return {
    contentDiffs: content,
    lineEndingOnlyDiffs: all.filter((name) => !contentSet.has(name)),
  }
}

function collectGitNames(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim()
    throw new Error(stderr || `git ${args.join(' ')} failed with exit code ${result.status}`)
  }
  return (options.parser ?? parseNames)(result.stdout)
}

function parseNames(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function parsePorcelainNames(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim() || line.startsWith('??')) return ''
      const renameArrow = line.indexOf(' -> ')
      if (renameArrow >= 0) return line.slice(renameArrow + 4).trim()
      return line.slice(3).trim()
    })
    .filter(Boolean)
}

function normalizeNames(names) {
  return sortUnique(names.map((name) => name.replace(/\\/g, '/')).filter(Boolean))
}

function sortUnique(names) {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

function printSection(title) {
  console.log(title)
  console.log('-'.repeat(title.length))
}

function printFileList(title, files) {
  console.log(`\n${title}: ${files.length}`)
  for (const file of files) {
    console.log(`  - ${file}`)
  }
}
