#!/usr/bin/env node
/**
 * bundle-size-check.mjs
 * ---------------------
 * 扫描 vite build 产物（默认 ai-assistant-ui/dist），输出 raw size
 * 和 gzip size 报告。可选地与 baseline 文件对比，超阈值时退出码非零，
 * 适合 CI 拦截无意中变胖的 PR。
 *
 * 用法：
 *   node scripts/bundle-size-check.mjs [选项]
 *
 * 选项：
 *   --dir <path>           dist 目录，默认 ai-assistant-ui/dist
 *   --baseline <path>      baseline JSON 路径（用于对比和阈值告警）
 *   --update-baseline      把当前 size 写入 baseline，跳过对比
 *   --max-delta-percent N  与 baseline 对比时允许的最大增长百分比，默认 10
 *   --ext <comma-list>     纳入统计的扩展名，默认 js,mjs,cjs,css
 *   --top N                最多显示前 N 个最大文件，默认 20
 *   --json                 以 JSON 输出，不打印表格
 *   --help, -h             显示帮助
 *
 * Baseline JSON 格式：
 *   {
 *     "files": {
 *       "ai-assistant.mjs": { "size": 588749, "gzip": 130001 },
 *       ...
 *     },
 *     "updatedAt": "2026-05-13T07:00:00Z"
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

const distDir = path.resolve(root, args.dir || 'ai-assistant-ui/dist');
const baselinePath = args.baseline ? path.resolve(root, args.baseline) : path.join(root, 'scripts', '.bundle-size-baseline.json');
const maxDeltaPercent = args.maxDeltaPercent != null ? Number(args.maxDeltaPercent) : 10;
const extensions = (args.ext || 'js,mjs,cjs,css').split(',').map((e) => e.trim().toLowerCase());
const topN = args.top != null ? Number(args.top) : 20;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') out.dir = argv[++i];
    else if (a === '--baseline') out.baseline = argv[++i];
    else if (a === '--update-baseline') out.updateBaseline = true;
    else if (a === '--max-delta-percent') out.maxDeltaPercent = argv[++i];
    else if (a === '--ext') out.ext = argv[++i];
    else if (a === '--top') out.top = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8');
      console.log(src.split('\n').slice(1, 32).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function formatDelta(actual, baseline) {
  if (baseline == null) return '—';
  const deltaBytes = actual - baseline;
  if (Math.abs(deltaBytes) < 50) return '±0.00 KB';
  const sign = deltaBytes >= 0 ? '+' : '';
  const deltaKB = (deltaBytes / 1024).toFixed(2);
  const pct = ((deltaBytes / baseline) * 100).toFixed(1);
  return `${sign}${deltaKB} KB (${sign}${pct}%)`;
}

function colorize(text, color) {
  if (process.env.NO_COLOR || !process.stdout.isTTY) return text;
  const codes = { green: 32, yellow: 33, red: 31, gray: 90 };
  const c = codes[color];
  return c ? `\x1b[${c}m${text}\x1b[0m` : text;
}

if (!fs.existsSync(distDir)) {
  console.error(`Dist directory not found: ${distDir}`);
  console.error('Run `npm run build` (or build:lib) in the relevant package first.');
  process.exit(2);
}

const allFiles = walk(distDir);
const targets = allFiles.filter((f) => {
  const ext = path.extname(f).slice(1).toLowerCase();
  return extensions.includes(ext);
});
if (targets.length === 0) {
  console.error(`No matching files (.${extensions.join('/.')}) under ${distDir}`);
  process.exit(2);
}

const entries = targets
  .map((full) => {
    const buf = fs.readFileSync(full);
    const gzipBuf = zlib.gzipSync(buf, { level: 9 });
    return {
      relative: path.relative(distDir, full).replace(/\\/g, '/'),
      size: buf.length,
      gzip: gzipBuf.length,
    };
  })
  .sort((a, b) => b.gzip - a.gzip);

const totals = entries.reduce(
  (acc, e) => {
    acc.size += e.size;
    acc.gzip += e.gzip;
    return acc;
  },
  { size: 0, gzip: 0 },
);

/* Baseline ops */
let baseline = null;
if (args.updateBaseline) {
  baseline = {
    updatedAt: new Date().toISOString(),
    files: Object.fromEntries(entries.map((e) => [e.relative, { size: e.size, gzip: e.gzip }])),
  };
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  console.log(`Baseline written to ${path.relative(root, baselinePath)} (${entries.length} files)`);
} else if (fs.existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  } catch (e) {
    console.warn(`Failed to parse baseline ${baselinePath}: ${e.message}`);
  }
}

if (args.json) {
  process.stdout.write(JSON.stringify({ totals, entries, baseline }, null, 2));
  process.exit(0);
}

/* Pretty table */
const head = ['File', 'Size (raw)', 'Size (gz)', 'Δ gz vs baseline'];
const rows = entries.slice(0, topN).map((e) => {
  const b = baseline?.files?.[e.relative];
  return [
    e.relative,
    formatKB(e.size),
    formatKB(e.gzip),
    b ? formatDelta(e.gzip, b.gzip) : '—',
  ];
});

const widths = head.map((h, i) =>
  Math.max(h.length, ...rows.map((r) => r[i].length)),
);

function pad(s, w, right = false) {
  return right ? s.padStart(w) : s.padEnd(w);
}

const sep = '─'.repeat(widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 3);
console.log(sep);
console.log(
  head.map((h, i) => pad(h, widths[i], i > 0)).join(' │ '),
);
console.log(sep);
let overBudget = 0;
for (const e of entries.slice(0, topN)) {
  const b = baseline?.files?.[e.relative];
  const deltaPct = b ? ((e.gzip - b.gzip) / b.gzip) * 100 : 0;
  const color = !b
    ? 'gray'
    : Math.abs(deltaPct) < 1
      ? 'gray'
      : deltaPct > maxDeltaPercent
        ? 'red'
        : deltaPct > 0
          ? 'yellow'
          : 'green';
  if (b && deltaPct > maxDeltaPercent) overBudget++;
  const row = [
    pad(e.relative, widths[0]),
    pad(formatKB(e.size), widths[1], true),
    pad(formatKB(e.gzip), widths[2], true),
    pad(b ? formatDelta(e.gzip, b.gzip) : '—', widths[3], true),
  ];
  console.log(colorize(row.join(' │ '), color));
}
console.log(sep);
console.log(
  pad('TOTAL', widths[0]) +
    ' │ ' +
    pad(formatKB(totals.size), widths[1], true) +
    ' │ ' +
    pad(formatKB(totals.gzip), widths[2], true) +
    ' │ ' +
    pad(
      baseline
        ? formatDelta(
            totals.gzip,
            Object.values(baseline.files).reduce((sum, f) => sum + f.gzip, 0),
          )
        : '—',
      widths[3],
      true,
    ),
);

if (entries.length > topN) {
  console.log(colorize(`...${entries.length - topN} smaller files omitted (--top ${topN})`, 'gray'));
}

if (!baseline) {
  console.log('');
  console.log(colorize('No baseline found. Run with --update-baseline to record current sizes.', 'gray'));
}

if (overBudget > 0) {
  console.error('');
  console.error(
    colorize(
      `❌ ${overBudget} file(s) exceed +${maxDeltaPercent}% gzip budget vs baseline.`,
      'red',
    ),
  );
  process.exit(1);
}
