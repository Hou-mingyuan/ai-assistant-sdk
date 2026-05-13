#!/usr/bin/env node
/**
 * coverage-check.mjs
 * ------------------
 * 读 vitest 输出的 `coverage-summary.json`，与 baseline 对比，
 * 输出按文件的 4 维（statements/branches/functions/lines）变化报告，
 * 超阈值时退出码非零，阻塞 CI。
 *
 * 用途：补充 vitest `thresholds`（绝对地板）—— 后者只能检测整体降到死线以下，
 * 本脚本能在覆盖率从 98% 滑到 95% 时就报警。
 *
 * 用法：
 *   node scripts/coverage-check.mjs [选项]
 *
 * 选项：
 *   --summary <path>          coverage-summary.json 路径，默认
 *                             ai-assistant-ui/coverage/coverage-summary.json
 *   --baseline <path>         baseline JSON 路径，默认 scripts/.coverage-baseline.json
 *   --update-baseline         以当前 summary 写 baseline，跳过对比
 *   --max-drop-percent N      允许的最大下降百分点（绝对差，0~100）。默认 1.0
 *                             例：基线 lines=96.50，本次 lines=95.40，差 1.10pt → fail
 *   --metric <list>           只检查指定维度，逗号分隔，可选
 *                             statements/branches/functions/lines（默认全部）
 *   --json                    以 JSON 输出，不打印表格
 *   --help, -h                显示帮助
 *
 * Baseline JSON 格式：
 *   {
 *     "updatedAt": "2026-05-13T07:00:00Z",
 *     "total":     { "lines": 96.23, "branches": 90.50, "functions": 81.01, "statements": 96.23 },
 *     "files":     { "<relative-path>": { "lines": 100, "branches": 100, "functions": 100, "statements": 100 }, ... }
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

const summaryPath = path.resolve(
  root,
  args.summary || 'ai-assistant-ui/coverage/coverage-summary.json',
);
const baselinePath = path.resolve(
  root,
  args.baseline || 'scripts/.coverage-baseline.json',
);
const maxDrop = args.maxDropPercent != null ? Number(args.maxDropPercent) : 1.0;
const allMetrics = ['statements', 'branches', 'functions', 'lines'];
const metrics = args.metric
  ? args.metric.split(',').map((s) => s.trim()).filter((m) => allMetrics.includes(m))
  : allMetrics;

if (metrics.length === 0) {
  console.error(`No valid --metric provided. Choose from: ${allMetrics.join(', ')}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--summary') out.summary = argv[++i];
    else if (a === '--baseline') out.baseline = argv[++i];
    else if (a === '--update-baseline') out.updateBaseline = true;
    else if (a === '--max-drop-percent') out.maxDropPercent = argv[++i];
    else if (a === '--metric') out.metric = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8');
      console.log(src.split('\n').slice(1, 36).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

function colorize(text, color) {
  if (process.env.NO_COLOR || !process.stdout.isTTY) return text;
  const codes = { green: 32, yellow: 33, red: 31, gray: 90, cyan: 36 };
  const c = codes[color];
  return c ? `\x1b[${c}m${text}\x1b[0m` : text;
}

if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary not found: ${summaryPath}`);
  console.error(
    'Run `npm run test:coverage` in ai-assistant-ui first (json-summary reporter is enabled).',
  );
  process.exit(2);
}

const summaryRaw = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

function toRel(absPath) {
  return path.relative(root, absPath).replace(/\\/g, '/');
}

function extractFilePct(node) {
  return Object.fromEntries(allMetrics.map((m) => [m, node?.[m]?.pct ?? 0]));
}

const totalPct = extractFilePct(summaryRaw.total);
const filePcts = {};
for (const [k, v] of Object.entries(summaryRaw)) {
  if (k === 'total') continue;
  filePcts[toRel(k)] = extractFilePct(v);
}

const fileEntries = Object.entries(filePcts).sort(([a], [b]) => a.localeCompare(b));

if (args.updateBaseline) {
  const out = {
    updatedAt: new Date().toISOString(),
    total: totalPct,
    files: filePcts,
  };
  fs.writeFileSync(baselinePath, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(
    `Baseline written to ${path.relative(root, baselinePath)} (${fileEntries.length} files).`,
  );
  console.log(
    `  total: ${metrics.map((m) => `${m}=${totalPct[m].toFixed(2)}%`).join(' ')}`,
  );
  process.exit(0);
}

let baseline = null;
if (fs.existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  } catch (e) {
    console.warn(`Failed to parse baseline ${baselinePath}: ${e.message}`);
  }
}

if (args.json) {
  process.stdout.write(JSON.stringify({ total: totalPct, files: filePcts, baseline }, null, 2));
  process.exit(0);
}

function formatPct(n) {
  return n.toFixed(2).padStart(6) + '%';
}

function formatDelta(actual, base) {
  if (base == null) return '   —  ';
  const diff = actual - base;
  if (Math.abs(diff) < 0.05) return ' ±0.00';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}`.padStart(6);
}

let regressions = 0;
const flagged = [];

console.log(colorize(`Coverage report (baseline ${baseline ? baseline.updatedAt : 'none'})`, 'cyan'));
console.log(
  colorize(
    `Max allowed drop: ${maxDrop} pt | Metrics: ${metrics.join(', ')}`,
    'gray',
  ),
);
console.log('');

/* Dynamic file column width to handle long monorepo paths. */
const fileColumnWidth = Math.max(
  6, /* len("File") + padding */
  ...fileEntries.map(([rel]) => rel.length),
) + 2;
const metricCellWidth = 16; /* "100.00% (-12.34) " */

const header =
  '  ' + 'File'.padEnd(fileColumnWidth) +
  metrics.map((m) => m.padStart(metricCellWidth)).join('');
console.log(header);
console.log(colorize('  ' + '─'.repeat(header.length - 2), 'gray'));

function trackRegression(name, current, base, isTotal) {
  if (!base) return;
  for (const m of metrics) {
    const cur = current[m] ?? 0;
    const baseVal = base[m];
    if (baseVal == null) continue;
    const delta = cur - baseVal;
    if (delta < -maxDrop) {
      regressions++;
      flagged.push({ scope: isTotal ? 'TOTAL' : name, metric: m, base: baseVal, current: cur, delta });
    }
  }
}

function printRow(name, current, base, isTotal) {
  const cells = metrics
    .map((m) => {
      const cur = current[m] ?? 0;
      const baseVal = base?.[m];
      const delta = baseVal != null ? cur - baseVal : null;
      let color = 'gray';
      if (delta != null) {
        if (delta < -maxDrop) color = 'red';
        else if (delta < -0.05) color = 'yellow';
        else if (delta > 0.05) color = 'green';
      }
      const cell = `${formatPct(cur)} (${formatDelta(cur, baseVal)})`;
      return colorize(cell.padStart(metricCellWidth), color);
    })
    .join('');
  const label = isTotal
    ? colorize('  ' + 'TOTAL'.padEnd(fileColumnWidth), 'cyan')
    : '  ' + name.padEnd(fileColumnWidth);
  console.log(label + cells);
}

if (baseline) {
  printRow('total', totalPct, baseline.total, true);
  trackRegression('total', totalPct, baseline.total, true);
  console.log('');
}
for (const [rel, pct] of fileEntries) {
  const base = baseline?.files?.[rel];
  printRow(rel, pct, base, false);
  trackRegression(rel, pct, base, false);
}
if (!baseline) {
  console.log('');
  console.log(
    colorize(
      'No baseline yet. Run with --update-baseline to record current coverage as the new floor.',
      'gray',
    ),
  );
  console.log('');
  printRow('total', totalPct, null, true);
}

if (regressions > 0) {
  console.error('');
  console.error(colorize(`❌ ${regressions} regression(s) exceeding ${maxDrop}pt drop:`, 'red'));
  for (const f of flagged) {
    console.error(
      colorize(
        `  ${f.scope} · ${f.metric}: ${f.base.toFixed(2)}% → ${f.current.toFixed(2)}% (${f.delta.toFixed(2)}pt)`,
        'red',
      ),
    );
  }
  console.error(colorize('  Fix by adding tests, or run --update-baseline if drop is intentional.', 'gray'));
  process.exit(1);
}

console.log('');
console.log(colorize(`✓ No regressions beyond ${maxDrop}pt threshold.`, 'green'));
