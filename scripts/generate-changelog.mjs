#!/usr/bin/env node
/**
 * generate-changelog.mjs
 * ----------------------
 * 从 git log 提取 conventional commits 并生成 / 更新 CHANGELOG.md。
 *
 * 用法：
 *   node scripts/generate-changelog.mjs [--from <ref>] [--to <ref>] [--output <path>] [--unreleased]
 *
 * 选项：
 *   --from <ref>      起始 ref（exclusive），默认从首个 commit
 *   --to <ref>        结束 ref（inclusive），默认 HEAD
 *   --output <path>   输出文件路径，默认 ./CHANGELOG.md
 *   --unreleased      只输出 [Unreleased] 段落到 stdout，不写文件
 *   --since-tag       自动从最近一个 tag 开始（fallback：全量）
 *
 * Conventional Commit 类型 → 分组：
 *   feat  → ✨ Features
 *   fix   → 🐛 Bug Fixes
 *   perf  → ⚡ Performance Improvements
 *   refactor → ♻️ Refactors
 *   style → 🎨 Style
 *   docs  → 📚 Documentation
 *   test  → 🧪 Tests
 *   chore → 🔧 Chores
 *   build → 🏗️ Build
 *   ci    → 🤖 CI
 *   其他  → 🌱 Other
 *
 * 不会写时区到 CHANGELOG（用 YYYY-MM-DD），保证可复现。
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = parseArgs(process.argv.slice(2));
const outputPath = args.output || path.join(root, 'CHANGELOG.md');

const TYPE_LABELS = [
  { type: 'feat', label: '✨ Features' },
  { type: 'fix', label: '🐛 Bug Fixes' },
  { type: 'perf', label: '⚡ Performance Improvements' },
  { type: 'refactor', label: '♻️ Refactors' },
  { type: 'style', label: '🎨 Style' },
  { type: 'docs', label: '📚 Documentation' },
  { type: 'test', label: '🧪 Tests' },
  { type: 'chore', label: '🔧 Chores' },
  { type: 'build', label: '🏗️ Build' },
  { type: 'ci', label: '🤖 CI' },
  { type: 'other', label: '🌱 Other' },
];

const CONVENTIONAL_RE = /^(feat|fix|perf|refactor|style|docs|test|chore|build|ci)(?:\(([^)]+)\))?(!?):\s*(.+)$/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from') out.from = argv[++i];
    else if (a === '--to') out.to = argv[++i];
    else if (a === '--output') out.output = argv[++i];
    else if (a === '--unreleased') out.unreleased = true;
    else if (a === '--since-tag') out.sinceTag = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8').split('\n').slice(1, 25).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf-8' }).trim();
}

function listCommits(fromRef, toRef) {
  const range = fromRef ? `${fromRef}..${toRef || 'HEAD'}` : (toRef || 'HEAD');
  /* Format: <hash><TAB><subject><TAB><ISO date><TAB><author> */
  const raw = sh(`git log ${range} --no-merges --pretty=format:%H%x09%s%x09%aI%x09%an`);
  if (!raw) return [];
  return raw.split('\n').map((line) => {
    const [hash, subject, isoDate, author] = line.split('\t');
    return {
      hash,
      shortHash: hash.slice(0, 7),
      subject,
      date: isoDate.slice(0, 10),
      author,
    };
  });
}

function classify(subject) {
  const m = subject.match(CONVENTIONAL_RE);
  if (!m) return { type: 'other', scope: null, breaking: false, desc: subject };
  return {
    type: m[1],
    scope: m[2] || null,
    breaking: m[3] === '!',
    desc: m[4].trim(),
  };
}

function getRepoUrl() {
  try {
    const remote = sh('git config --get remote.origin.url');
    /* git@github.com:owner/repo.git → https://github.com/owner/repo */
    const sshMatch = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;
    /* https://github.com/owner/repo.git → strip .git */
    return remote.replace(/\.git$/, '');
  } catch {
    return null;
  }
}

function getLatestTag() {
  try {
    return sh('git describe --tags --abbrev=0');
  } catch {
    return null;
  }
}

function groupCommits(commits) {
  const groups = new Map();
  const breaking = [];
  for (const c of commits) {
    const cls = classify(c.subject);
    if (cls.breaking) breaking.push({ ...c, ...cls });
    const list = groups.get(cls.type) ?? [];
    list.push({ ...c, ...cls });
    groups.set(cls.type, list);
  }
  return { groups, breaking };
}

function renderSection(title, dateRange, commits, repoUrl) {
  if (commits.length === 0) return '';
  const { groups, breaking } = groupCommits(commits);
  const lines = [`## ${title}`];
  if (dateRange) lines.push('', `_${dateRange}_`);
  lines.push('');

  if (breaking.length > 0) {
    lines.push('### ⚠️ BREAKING CHANGES');
    lines.push('');
    for (const c of breaking) {
      lines.push(formatCommitLine(c, repoUrl));
    }
    lines.push('');
  }

  for (const { type, label } of TYPE_LABELS) {
    const list = groups.get(type);
    if (!list || list.length === 0) continue;
    lines.push(`### ${label}`);
    lines.push('');
    for (const c of list) {
      lines.push(formatCommitLine(c, repoUrl));
    }
    lines.push('');
  }
  return lines.join('\n');
}

function formatCommitLine(c, repoUrl) {
  const scope = c.scope ? `**${c.scope}:** ` : '';
  const hashLink = repoUrl
    ? `[\`${c.shortHash}\`](${repoUrl}/commit/${c.hash})`
    : `\`${c.shortHash}\``;
  return `- ${scope}${c.desc} ${hashLink}`;
}

function main() {
  let fromRef = args.from;
  if (!fromRef && args.sinceTag) {
    const tag = getLatestTag();
    if (tag) fromRef = tag;
  }
  const toRef = args.to || 'HEAD';
  const commits = listCommits(fromRef, toRef);
  if (commits.length === 0) {
    console.error('No commits found in given range.');
    process.exit(args.unreleased ? 0 : 1);
  }
  const repoUrl = getRepoUrl();

  if (args.unreleased) {
    /* 输出到 stdout，不写文件 */
    const head = `[Unreleased] ${commits[commits.length - 1].date} → ${commits[0].date}`;
    const range = fromRef ? `Since \`${fromRef}\`` : `Earliest commit → HEAD`;
    process.stdout.write(renderSection(head, range, commits, repoUrl) + '\n');
    return;
  }

  /* 整段全量重写 CHANGELOG.md。
   * 思路：分别按"日期"分组，相同日期内按类型排序。
   * 更细的策略（按 tag 分版本）可后续扩展；当前版本不依赖 tag。 */
  const byDate = new Map();
  for (const c of commits) {
    const list = byDate.get(c.date) ?? [];
    list.push(c);
    byDate.set(c.date, list);
  }
  const dates = [...byDate.keys()].sort().reverse();

  const lines = [
    '# Changelog',
    '',
    '> 由 `scripts/generate-changelog.mjs` 从 git log 自动生成。',
    '> 采用 [Conventional Commits](https://www.conventionalcommits.org/) 类型分组。',
    '',
  ];
  for (const date of dates) {
    const dayCommits = byDate.get(date);
    lines.push(renderSection(date, '', dayCommits, repoUrl));
  }

  fs.writeFileSync(outputPath, lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', 'utf-8');
  console.log(`Wrote ${commits.length} commits to ${path.relative(root, outputPath)} (${dates.length} day(s))`);
}

try {
  main();
} catch (err) {
  console.error('generate-changelog failed:', err.message);
  process.exit(1);
}
