#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}

function runCli() {
  const baseline = JSON.parse(
    readFileSync(path.join(root, 'scripts/.bundle-size-baseline.json'), 'utf8'),
  )
  const summary = summarizeGroups(groupBundleFiles(baseline.files ?? {}))
  console.log('Bundle composition report (baseline gzip)\n')
  for (const row of summary) {
    console.log(
      `${row.name.padEnd(18)} ${formatBytes(row.gzip).padStart(9)} gzip  ${String(row.count).padStart(3)} file(s)`,
    )
  }
}

export function groupBundleFiles(files) {
  const groups = {
    main: emptyGroup(),
    webComponent: emptyGroup(),
    styles: emptyGroup(),
    workers: emptyGroup(),
    secondaryEntries: emptyGroup(),
    featureChunks: emptyGroup(),
  }

  for (const [file, stat] of Object.entries(files)) {
    const group = pickGroup(file)
    groups[group].files.push(file)
    groups[group].size += stat.size ?? 0
    groups[group].gzip += stat.gzip ?? 0
  }
  return groups
}

export function summarizeGroups(groups) {
  return Object.entries(groups)
    .map(([name, group]) => ({
      name,
      count: group.files.length,
      size: group.size,
      gzip: group.gzip,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.gzip - a.gzip)
}

function pickGroup(file) {
  if (file === 'ai-assistant.mjs' || file === 'ai-assistant.umd.cjs') return 'main'
  if (file.startsWith('AiAssistant-')) return 'main'
  if (file.startsWith('ai-assistant-wc')) return 'webComponent'
  if (file === 'style.css') return 'styles'
  if (file.startsWith('assets/')) return 'workers'
  if (/^(admin|mcp|form-fill|plugin|screenshot)(\.|$)/.test(file)) return 'secondaryEntries'
  return 'featureChunks'
}

function emptyGroup() {
  return { files: [], size: 0, gzip: 0 }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
