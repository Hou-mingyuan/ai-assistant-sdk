#!/usr/bin/env node
/**
 * Verify that every published package export points at a file produced by the
 * current build. This catches dist overwrite regressions before npm publish.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(root, 'ai-assistant-ui');
const packageJsonPath = path.join(packageDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const missing = [];
const checked = [];
const browserUnsafe = [];

function collectExportTargets(value, trail = []) {
  if (typeof value === 'string') {
    return [{ path: value, condition: trail.join('.') || 'default' }];
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => collectExportTargets(child, [...trail, key]));
}

function checkPackagePath(label, relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return;
  const normalized = relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
  const fullPath = path.join(packageDir, normalized);
  checked.push(`${label} -> ${relativePath}`);
  if (!fs.existsSync(fullPath)) {
    missing.push(`${label} -> ${relativePath}`);
  }
}

checkPackagePath('main', packageJson.main);
checkPackagePath('module', packageJson.module);
checkPackagePath('types', packageJson.types);

for (const [exportName, exportValue] of Object.entries(packageJson.exports ?? {})) {
  for (const target of collectExportTargets(exportValue)) {
    checkPackagePath(`exports["${exportName}"].${target.condition}`, target.path);
  }
}

if (missing.length > 0) {
  console.error('Package export check failed. Missing files:');
  for (const item of missing) console.error(`  - ${item}`);
  console.error('\nRun `npm run build` in ai-assistant-ui before publishing.');
  process.exit(1);
}

const webComponentUmdPath = path.join(packageDir, 'dist', 'ai-assistant-wc.umd.cjs');
if (fs.existsSync(webComponentUmdPath)) {
  const webComponentUmd = fs.readFileSync(webComponentUmdPath, 'utf8');
  if (/\bprocess\.env\b/.test(webComponentUmd)) {
    browserUnsafe.push('dist/ai-assistant-wc.umd.cjs contains unresolved process.env references');
  }
}

if (browserUnsafe.length > 0) {
  console.error('Package browser runtime check failed:');
  for (const item of browserUnsafe) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`Package export check OK (${checked.length} paths).`);
