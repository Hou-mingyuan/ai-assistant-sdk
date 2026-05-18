#!/usr/bin/env node
/**
 * release.mjs
 * -----------
 * 一键发版脚本：
 *
 *   1. 检查工作区干净（除非 --allow-dirty）
 *   2. 读取当前所有模块 version（maven + npm），确认一致
 *   3. 计算新版本号（--version <semver> 显式指定，或 --patch/--minor/--major 自增）
 *   4. 同步写回根 pom.xml、ai-assistant-server/service/client 的 pom.xml
 *      + ai-assistant-ui/package.json + ai-assistant-ui/package-lock.json
 *   5. 跑 check-version-consistency.mjs --release 验证一致
 *   6. 用 generate-changelog.mjs --since-tag 生成新版段落，插入 CHANGELOG.md 顶部
 *   7. git add 改动 + commit "chore(release): vX.Y.Z" + git tag vX.Y.Z
 *   8. 不 push（让用户手动 push 或 push --follow-tags）
 *
 * 用法：
 *   node scripts/release.mjs --patch        # 1.0.0 → 1.0.1
 *   node scripts/release.mjs --minor        # 1.0.0 → 1.1.0
 *   node scripts/release.mjs --major        # 1.0.0 → 2.0.0
 *   node scripts/release.mjs --version 2.3.4-rc1
 *
 * 可选：
 *   --dry-run             不实际写文件 / 不 commit / 不 tag，只打印执行计划
 *   --allow-dirty         允许工作区有未提交改动
 *   --no-commit           只改文件，不 git commit / tag
 *   --no-tag              git commit 但不 tag
 *   --skip-changelog      不更新 CHANGELOG.md
 *   --help, -h            显示帮助
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

const POMS = [
  'pom.xml',
  'ai-assistant-server/pom.xml',
  'ai-assistant-service/pom.xml',
  'ai-assistant-client/pom.xml',
];
const PKG = 'ai-assistant-ui/package.json';
const PKG_LOCK = 'ai-assistant-ui/package-lock.json';
const CHANGELOG_FILE = 'CHANGELOG.md';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') out.version = argv[++i];
    else if (a === '--patch') out.bump = 'patch';
    else if (a === '--minor') out.bump = 'minor';
    else if (a === '--major') out.bump = 'major';
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--allow-dirty') out.allowDirty = true;
    else if (a === '--no-commit') out.noCommit = true;
    else if (a === '--no-tag') out.noTag = true;
    else if (a === '--skip-changelog') out.skipChangelog = true;
    else if (a === '--help' || a === '-h') {
      const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8');
      console.log(src.split('\n').slice(1, 32).join('\n'));
      process.exit(0);
    }
  }
  if (!out.version && !out.bump) {
    console.error('error: must specify either --version <semver> or --patch/--minor/--major');
    process.exit(2);
  }
  return out;
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: 'utf-8', ...opts }).trim();
}

function shCheck(argv) {
  const res = spawnSync(argv[0], argv.slice(1), { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`Command failed: ${argv.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

function readFile(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf-8');
}

function writeFile(rel, content) {
  if (args.dryRun) {
    console.log(`[dry-run] would write ${rel} (${content.length} chars)`);
    return;
  }
  fs.writeFileSync(path.join(root, rel), content, 'utf-8');
}

function readMavenVersion(rel) {
  const xml = readFile(rel);
  /* Strip <parent> block first so we get the project's own <version>, not the parent's */
  const projectXml = xml.replace(/<parent>[\s\S]*?<\/parent>/, '');
  const m = projectXml.match(/<artifactId>[^<]+<\/artifactId>\s*<version>([^<]+)<\/version>/);
  if (!m) throw new Error(`Could not parse version from ${rel}`);
  return m[1];
}

function writeMavenVersion(rel, newVersion) {
  const xml = readFile(rel);
  /* Replace project version (not parent's) - re-use same regex that picked it up */
  let parentBlock = '';
  let body = xml;
  const parentMatch = xml.match(/<parent>[\s\S]*?<\/parent>/);
  if (parentMatch) {
    parentBlock = parentMatch[0];
    body = xml.replace(parentMatch[0], '\u0000PARENT\u0000');
  }
  const replaced = body.replace(
    /(<artifactId>[^<]+<\/artifactId>\s*<version>)([^<]+)(<\/version>)/,
    (_, p1, _old, p3) => `${p1}${newVersion}${p3}`,
  );
  const restored = replaced
    .replace('\u0000PARENT\u0000', parentBlock)
    .replace(
      /(<ai-assistant\.version>)[^<]+(<\/ai-assistant\.version>)/,
      `$1${newVersion}$2`,
    );
  writeFile(rel, restored);
}

function bumpSemver(current, kind) {
  const m = current.replace(/-.*$/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Cannot parse semver from "${current}"`);
  let [, maj, min, pat] = m.map(Number);
  if (kind === 'major') { maj += 1; min = 0; pat = 0; }
  else if (kind === 'minor') { min += 1; pat = 0; }
  else if (kind === 'patch') { pat += 1; }
  return `${maj}.${min}.${pat}`;
}

function ensureCleanWorktree() {
  if (args.allowDirty) return;
  const status = sh('git status --porcelain');
  if (status) {
    console.error('error: working tree is not clean. Commit or stash changes first, or pass --allow-dirty.');
    console.error(status);
    process.exit(2);
  }
}

function updateChangelog(newVersion) {
  if (args.skipChangelog) return;
  const scriptPath = path.join('scripts', 'generate-changelog.mjs');
  let unreleasedSection = '';
  try {
    unreleasedSection = sh(`node ${scriptPath} --since-tag --unreleased`);
  } catch {
    /* No prior tag yet: fall back to full log against null base */
    unreleasedSection = sh(`node ${scriptPath} --unreleased`);
  }
  if (!unreleasedSection.trim()) {
    console.log('No commit-level changes detected since last tag; skipping CHANGELOG update.');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const versionedSection = unreleasedSection.replace(
    /^## \[Unreleased\][^\n]*/,
    `## [v${newVersion}] ${today}`,
  );
  const changelogPath = path.join(root, CHANGELOG_FILE);
  const existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf-8')
    : '# Changelog\n';
  /* Insert after the top heading and any intro lines, before first "## " section */
  const lines = existing.split('\n');
  let insertAt = 1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { insertAt = i; break; }
    insertAt = i + 1;
  }
  const next = [
    ...lines.slice(0, insertAt),
    '',
    versionedSection.trim(),
    '',
    ...lines.slice(insertAt),
  ].join('\n').replace(/\n{3,}/g, '\n\n');
  if (args.dryRun) {
    console.log(`[dry-run] would prepend ${versionedSection.split('\n').length} lines to ${CHANGELOG_FILE}`);
  } else {
    fs.writeFileSync(changelogPath, next, 'utf-8');
    console.log(`Updated ${CHANGELOG_FILE} with v${newVersion} section`);
  }
}

function updatePackageJson(rel, newVersion) {
  const obj = JSON.parse(readFile(rel));
  obj.version = newVersion;
  writeFile(rel, JSON.stringify(obj, null, 2) + '\n');
}

function updatePackageLock(rel, newVersion) {
  if (!fs.existsSync(path.join(root, rel))) return;
  const obj = JSON.parse(readFile(rel));
  if (obj.version !== undefined) obj.version = newVersion;
  if (obj.packages?.[''] !== undefined) obj.packages[''].version = newVersion;
  writeFile(rel, JSON.stringify(obj, null, 2) + '\n');
}

/* ──────────────────────────── Main flow ──────────────────────────── */

ensureCleanWorktree();

const rawMavenVersions = POMS.map((p) => readMavenVersion(p));
const npmVersion = JSON.parse(readFile(PKG)).version;
/* Maven 习惯加 -SNAPSHOT 标记开发版；npm 通常不带。比较时统一去后缀。 */
const stripSnapshot = (v) => v.replace(/-SNAPSHOT$/, '');
const normalized = new Set([...rawMavenVersions, npmVersion].map(stripSnapshot));
if (normalized.size > 1) {
  console.error(
    `error: existing versions are inconsistent: maven=[${rawMavenVersions.join(', ')}] npm=${npmVersion}`,
  );
  console.error('Run `node scripts/check-version-consistency.mjs` for details first.');
  process.exit(2);
}
const currentVersion = [...normalized][0];

const newVersion = args.version || bumpSemver(currentVersion.replace(/-SNAPSHOT$/, ''), args.bump);
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error(`error: invalid semver "${newVersion}"`);
  process.exit(2);
}

console.log(`Releasing ${currentVersion} → ${newVersion}${args.dryRun ? ' (dry-run)' : ''}`);

for (const pom of POMS) writeMavenVersion(pom, newVersion);
updatePackageJson(PKG, newVersion);
updatePackageLock(PKG_LOCK, newVersion);

/* Sanity check consistency */
if (!args.dryRun) {
  shCheck(['node', path.join('scripts', 'check-version-consistency.mjs'), '--release']);
}

updateChangelog(newVersion);

if (args.dryRun) {
  console.log('[dry-run] complete — no git commit / tag performed.');
  process.exit(0);
}

if (args.noCommit) {
  console.log('Files updated; --no-commit means git commit / tag skipped.');
  process.exit(0);
}

const filesToCommit = [...POMS, PKG, PKG_LOCK, CHANGELOG_FILE]
  .filter((f) => fs.existsSync(path.join(root, f)));
shCheck(['git', 'add', ...filesToCommit]);
shCheck(['git', 'commit', '-m', `chore(release): v${newVersion}`]);

if (!args.noTag) {
  shCheck(['git', 'tag', '-a', `v${newVersion}`, '-m', `Release v${newVersion}`]);
  console.log(`\n✅ Released v${newVersion}. Run \`git push --follow-tags\` to publish.`);
} else {
  console.log(`\n✅ Committed v${newVersion}. (--no-tag, run \`git tag\` manually.)`);
}
