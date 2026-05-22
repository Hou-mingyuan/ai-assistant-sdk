#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const BASELINE_REFRESH_STEPS = [
  {
    name: 'bundle size baseline',
    command: 'scripts/bundle-size-check.mjs',
    args: ['--update-baseline'],
    checkArgs: ['--max-delta-percent', '10'],
  },
]

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseRefreshBaselineArgs(process.argv.slice(2))
  for (const step of BASELINE_REFRESH_STEPS) {
    console.log(`> ${args.check ? 'check' : 'refresh'} ${step.name}`)
    const stepArgs = args.check ? step.checkArgs : step.args
    const result = spawnSync(process.execPath, [path.join(root, step.command), ...stepArgs], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }
}

export function parseRefreshBaselineArgs(argv) {
  return { check: argv.includes('--check') }
}
