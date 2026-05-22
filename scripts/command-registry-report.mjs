#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const COMMAND_REGISTRY_FAMILIES = [
  { name: 'app', source: 'app', description: 'Application commands' },
  { name: 'prompt', source: 'prompt', description: 'Prompt commands' },
  { name: 'feature', source: 'feature', description: 'Feature commands' },
  { name: 'workflow', source: 'workflow', description: 'Workflow commands' },
]

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2))
  const report = buildCommandRegistryReport()
  console.log(report)
  if (args.markdownOut) {
    writeFileSync(path.resolve(root, args.markdownOut), report, 'utf8')
  }
}

export function buildCommandRegistryReport() {
  return [
    '### Command Registry Families',
    '',
    '| Family | Source | Description |',
    '| --- | --- | --- |',
    ...COMMAND_REGISTRY_FAMILIES.map(
      (family) => `| ${family.name} | ${family.source} | ${family.description} |`,
    ),
    '',
  ].join('\n')
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--markdown-out') out.markdownOut = argv[++i]
  }
  return out
}
