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
  },
]

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const step of BASELINE_REFRESH_STEPS) {
    console.log(`> refresh ${step.name}`)
    const result = spawnSync(process.execPath, [path.join(root, step.command), ...step.args], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }
}
