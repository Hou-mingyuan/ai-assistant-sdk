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
 *   --markdown             以 GitHub-flavored Markdown 输出（适合 PR comment）
 *   --markdown-out <path>  写 Markdown 到指定文件（与 --markdown 等价但有副本）
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

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const isCli = process.argv[1] && path.resolve(process.argv[1]) === modulePath;

const MAIN_ENTRY_FILES = new Set([
    "ai-assistant.mjs",
    "ai-assistant.umd.cjs",
    "style.css",
]);
const WC_ENTRY_FILES = new Set([
    "ai-assistant-wc.mjs",
    "ai-assistant-wc.umd.cjs",
    "vue.css",
]);
const SECONDARY_ENTRY_PREFIXES = [
    "admin",
    "form-fill",
    "mcp",
    "plugin",
    "screenshot",
];

export function classifyBundleEntry(relativePath) {
    if (MAIN_ENTRY_FILES.has(relativePath)) return "main";
    if (
        WC_ENTRY_FILES.has(relativePath) ||
        relativePath.startsWith("AiAssistant-") ||
        relativePath.startsWith("vue.runtime.esm-bundler-")
    ) {
        return "wc";
    }
    if (
        SECONDARY_ENTRY_PREFIXES.some(
            (name) =>
                relativePath === `${name}.mjs` ||
                relativePath === `${name}.umd.cjs`,
        )
    ) {
        return "secondary";
    }
    return "chunks";
}

export function groupBundleEntries(entries) {
    const groups = {};
    for (const entry of entries) {
        const group = classifyBundleEntry(entry.relative);
        groups[group] ??= { files: 0, gzip: 0 };
        groups[group].files += 1;
        groups[group].gzip += entry.gzip;
    }
    return groups;
}

export function summarizeBaselineChanges(entries, baseline, maxDeltaPercent = 10) {
    const baselineFiles = baseline?.files ?? {};
    const actualByFile = new Map(entries.map((entry) => [entry.relative, entry]));
    const added = entries
        .filter((entry) => !baselineFiles[entry.relative])
        .sort((a, b) => b.gzip - a.gzip);
    const removed = Object.entries(baselineFiles)
        .filter(([relative]) => !actualByFile.has(relative))
        .map(([relative, value]) => ({
            relative,
            size: value.size ?? 0,
            gzip: value.gzip ?? 0,
        }))
        .sort((a, b) => b.gzip - a.gzip);
    const changed = entries
        .map((entry) => {
            const base = baselineFiles[entry.relative];
            if (!base?.gzip) return null;
            const deltaGzip = entry.gzip - base.gzip;
            const deltaPercent = (deltaGzip / base.gzip) * 100;
            return { ...entry, baselineGzip: base.gzip, deltaGzip, deltaPercent };
        })
        .filter(Boolean);
    const grown = changed
        .filter((entry) => entry.deltaGzip > 0 && entry.deltaPercent > maxDeltaPercent)
        .sort((a, b) => b.deltaGzip - a.deltaGzip);
    const shrunk = changed
        .filter((entry) => entry.deltaGzip < 0)
        .sort((a, b) => a.deltaGzip - b.deltaGzip);
    return { added, removed, grown, shrunk };
}

if (isCli) {
    const root = path.resolve(path.dirname(modulePath), "..");
    const args = parseArgs(process.argv.slice(2));

    const distDir = path.resolve(root, args.dir || "ai-assistant-ui/dist");
    const baselinePath = args.baseline
        ? path.resolve(root, args.baseline)
        : path.join(root, "scripts", ".bundle-size-baseline.json");
    const maxDeltaPercent =
        args.maxDeltaPercent != null ? Number(args.maxDeltaPercent) : 10;
    const extensions = (args.ext || "js,mjs,cjs,css")
        .split(",")
        .map((e) => e.trim().toLowerCase());
    const topN = args.top != null ? Number(args.top) : 20;

    function parseArgs(argv) {
        const out = {};
        for (let i = 0; i < argv.length; i++) {
            const a = argv[i];
            if (a === "--dir") out.dir = argv[++i];
            else if (a === "--baseline") out.baseline = argv[++i];
            else if (a === "--update-baseline") out.updateBaseline = true;
            else if (a === "--max-delta-percent")
                out.maxDeltaPercent = argv[++i];
            else if (a === "--ext") out.ext = argv[++i];
            else if (a === "--top") out.top = argv[++i];
            else if (a === "--json") out.json = true;
            else if (a === "--markdown") out.markdown = true;
            else if (a === "--markdown-out") {
                out.markdown = true;
                out.markdownOut = argv[++i];
            } else if (a === "--help" || a === "-h") {
                const src = fs.readFileSync(
                    fileURLToPath(import.meta.url),
                    "utf-8",
                );
                console.log(src.split("\n").slice(1, 35).join("\n"));
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
        return (bytes / 1024).toFixed(2) + " KB";
    }

    function formatDelta(actual, baseline) {
        if (baseline == null) return "—";
        const deltaBytes = actual - baseline;
        if (Math.abs(deltaBytes) < 50) return "±0.00 KB";
        const sign = deltaBytes >= 0 ? "+" : "";
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
        console.error(
            "Run `npm run build` (or build:lib) in the relevant package first.",
        );
        process.exit(2);
    }

    const allFiles = walk(distDir);
    const targets = allFiles.filter((f) => {
        const ext = path.extname(f).slice(1).toLowerCase();
        return extensions.includes(ext);
    });
    if (targets.length === 0) {
        console.error(
            `No matching files (.${extensions.join("/.")}) under ${distDir}`,
        );
        process.exit(2);
    }

    const entries = targets
        .map((full) => {
            const buf = fs.readFileSync(full);
            const gzipBuf = zlib.gzipSync(buf, { level: 9 });
            return {
                relative: path.relative(distDir, full).replace(/\\/g, "/"),
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
    const groups = groupBundleEntries(entries);

    /* Baseline ops */
    let baseline = null;
    if (args.updateBaseline) {
        baseline = {
            updatedAt: new Date().toISOString(),
            files: Object.fromEntries(
                entries.map((e) => [
                    e.relative,
                    { size: e.size, gzip: e.gzip },
                ]),
            ),
            groups,
        };
        fs.writeFileSync(
            baselinePath,
            JSON.stringify(baseline, null, 2) + "\n",
            "utf-8",
        );
        console.log(
            `Baseline written to ${path.relative(root, baselinePath)} (${entries.length} files)`,
        );
    } else if (fs.existsSync(baselinePath)) {
        try {
            baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
        } catch (e) {
            console.warn(
                `Failed to parse baseline ${baselinePath}: ${e.message}`,
            );
        }
    }

    if (args.json) {
        process.stdout.write(
            JSON.stringify({ totals, entries, baseline }, null, 2),
        );
        process.exit(0);
    }

    if (args.markdown) {
        const md = renderMarkdown(
            entries,
            totals,
            groups,
            baseline,
            maxDeltaPercent,
            topN,
        );
        if (args.markdownOut) {
            fs.writeFileSync(args.markdownOut, md, "utf-8");
            console.log(`Markdown report written to ${args.markdownOut}`);
        } else {
            process.stdout.write(md);
        }
        /* Still compute overBudget so CI can fail when budget exceeded. */
        const overBudgetCount =
            countOverBudget(entries, baseline, maxDeltaPercent) +
            countGroupOverBudget(groups, baseline, maxDeltaPercent);
        if (overBudgetCount > 0) {
            process.stderr.write(
                `${overBudgetCount} file/group budget(s) exceed +${maxDeltaPercent}% gzip budget vs baseline.\n`,
            );
            process.exit(1);
        }
        process.exit(0);
    }

    function countOverBudget(entries, baseline, maxPct) {
        if (!baseline) return 0;
        let n = 0;
        for (const e of entries) {
            const b = baseline.files?.[e.relative];
            if (!b) continue;
            if (((e.gzip - b.gzip) / b.gzip) * 100 > maxPct) n++;
        }
        return n;
    }

    function baselineGroupsFromFiles(baseline) {
        if (!baseline) return null;
        if (baseline.groups) return baseline.groups;
        return groupBundleEntries(
            Object.entries(baseline.files ?? {}).map(([relative, value]) => ({
                relative,
                gzip: value.gzip || 0,
            })),
        );
    }

    function countGroupOverBudget(groups, baseline, maxPct) {
        const baselineGroups = baselineGroupsFromFiles(baseline);
        if (!baselineGroups) return 0;
        let n = 0;
        for (const [name, group] of Object.entries(groups)) {
            const base = baselineGroups[name];
            if (!base?.gzip) continue;
            if (((group.gzip - base.gzip) / base.gzip) * 100 > maxPct) n++;
        }
        return n;
    }

    function renderMarkdown(entries, totals, groups, baseline, maxPct, top) {
        const lines = [];
        const baselineTotal = baseline
            ? Object.values(baseline.files).reduce(
                  (acc, f) => ({
                      size: acc.size + (f.size || 0),
                      gzip: acc.gzip + (f.gzip || 0),
                  }),
                  { size: 0, gzip: 0 },
              )
            : null;
        lines.push("### 📦 Bundle Size Report");
        lines.push("");
        if (baseline) {
            const totalDeltaPct =
                ((totals.gzip - baselineTotal.gzip) / baselineTotal.gzip) * 100;
            const trend =
                Math.abs(totalDeltaPct) < 0.1
                    ? "➖ no change"
                    : totalDeltaPct > maxPct
                      ? `🚫 **+${totalDeltaPct.toFixed(2)}%** over +${maxPct}% budget`
                      : totalDeltaPct > 0
                        ? `⚠️ +${totalDeltaPct.toFixed(2)}%`
                        : `✅ ${totalDeltaPct.toFixed(2)}%`;
            lines.push(
                `**Total gzip:** ${formatKB(totals.gzip)} (raw ${formatKB(totals.size)}) — ` +
                    `vs baseline ${formatKB(baselineTotal.gzip)} → ${trend}`,
            );
        } else {
            lines.push(
                `**Total gzip:** ${formatKB(totals.gzip)} (raw ${formatKB(totals.size)}) — _no baseline_`,
            );
        }
        lines.push("");
        if (baseline) {
            const changes = summarizeBaselineChanges(entries, baseline, maxPct);
            lines.push("#### Change Summary");
            lines.push("");
            lines.push(renderMarkdownChangeList("Added", changes.added));
            lines.push(renderMarkdownChangeList("Removed", changes.removed));
            lines.push(renderMarkdownDeltaList("Over budget growth", changes.grown));
            lines.push(renderMarkdownDeltaList("Shrunk", changes.shrunk));
            lines.push("");
        }
        lines.push("| Group | Files | Gzip | Δ gzip vs baseline |");
        lines.push("| --- | ---: | ---: | ---: |");
        const baselineGroups = baselineGroupsFromFiles(baseline);
        for (const [name, group] of Object.entries(groups)) {
            const base = baselineGroups?.[name];
            let deltaCell = "—";
            if (base?.gzip) {
                const diff = group.gzip - base.gzip;
                const sign = diff >= 0 ? "+" : "";
                const pct = ((diff / base.gzip) * 100).toFixed(1);
                const arrow =
                    diff > 0
                        ? diff / base.gzip > maxPct / 100
                            ? "🚫"
                            : "🔺"
                        : "🟢";
                deltaCell =
                    Math.abs(diff) < 50
                        ? "±0.00 KB"
                        : `${arrow} ${sign}${(diff / 1024).toFixed(2)} KB (${sign}${pct}%)`;
            }
            lines.push(
                `| \`${name}\` | ${group.files} | ${formatKB(group.gzip)} | ${deltaCell} |`,
            );
        }
        lines.push("");
        lines.push("| File | Raw | Gzip | Δ gzip vs baseline |");
        lines.push("| --- | ---: | ---: | ---: |");
        for (const e of entries.slice(0, top)) {
            const b = baseline?.files?.[e.relative];
            let deltaCell = "—";
            if (b) {
                const diff = e.gzip - b.gzip;
                if (Math.abs(diff) < 50) {
                    deltaCell = "±0.00 KB";
                } else {
                    const sign = diff >= 0 ? "+" : "";
                    const pct = ((diff / b.gzip) * 100).toFixed(1);
                    const arrow =
                        diff > 0
                            ? diff / b.gzip > maxPct / 100
                                ? "🚫"
                                : "🔺"
                            : "🟢";
                    deltaCell = `${arrow} ${sign}${(diff / 1024).toFixed(2)} KB (${sign}${pct}%)`;
                }
            }
            lines.push(
                `| \`${e.relative}\` | ${formatKB(e.size)} | ${formatKB(e.gzip)} | ${deltaCell} |`,
            );
        }
        if (entries.length > top) {
            lines.push(
                `| _…${entries.length - top} smaller files omitted (--top ${top})_ |  |  |  |`,
            );
        }
        lines.push("");
        lines.push(
            `<sub>Budget: any single file or bundle group gzip growing > **+${maxPct}%** vs baseline fails the build. ` +
                `Update baseline with \`node scripts/bundle-size-check.mjs --update-baseline && git add scripts/.bundle-size-baseline.json\`.</sub>`,
        );
        lines.push("");
        return lines.join("\n");
    }

    function renderMarkdownChangeList(label, entries) {
        if (entries.length === 0) return `- **${label}:** none`;
        return `- **${label}:** ${entries
            .slice(0, 5)
            .map((entry) => `\`${entry.relative}\` (${formatKB(entry.gzip)} gzip)`)
            .join(", ")}${entries.length > 5 ? `, +${entries.length - 5} more` : ""}`;
    }

    function renderMarkdownDeltaList(label, entries) {
        if (entries.length === 0) return `- **${label}:** none`;
        return `- **${label}:** ${entries
            .slice(0, 5)
            .map(
                (entry) =>
                    `\`${entry.relative}\` (${formatDelta(entry.gzip, entry.baselineGzip)})`,
            )
            .join(", ")}${entries.length > 5 ? `, +${entries.length - 5} more` : ""}`;
    }

    /* Pretty table */
    const head = ["File", "Size (raw)", "Size (gz)", "Δ gz vs baseline"];
    const rows = entries.slice(0, topN).map((e) => {
        const b = baseline?.files?.[e.relative];
        return [
            e.relative,
            formatKB(e.size),
            formatKB(e.gzip),
            b ? formatDelta(e.gzip, b.gzip) : "—",
        ];
    });

    const widths = head.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => r[i].length)),
    );

    function pad(s, w, right = false) {
        return right ? s.padStart(w) : s.padEnd(w);
    }

    const sep = "─".repeat(
        widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 3,
    );
    console.log(sep);
    console.log(head.map((h, i) => pad(h, widths[i], i > 0)).join(" │ "));
    console.log(sep);
    let overBudget = 0;
    for (const e of entries.slice(0, topN)) {
        const b = baseline?.files?.[e.relative];
        const deltaPct = b ? ((e.gzip - b.gzip) / b.gzip) * 100 : 0;
        const color = !b
            ? "gray"
            : Math.abs(deltaPct) < 1
              ? "gray"
              : deltaPct > maxDeltaPercent
                ? "red"
                : deltaPct > 0
                  ? "yellow"
                  : "green";
        if (b && deltaPct > maxDeltaPercent) overBudget++;
        const row = [
            pad(e.relative, widths[0]),
            pad(formatKB(e.size), widths[1], true),
            pad(formatKB(e.gzip), widths[2], true),
            pad(b ? formatDelta(e.gzip, b.gzip) : "—", widths[3], true),
        ];
        console.log(colorize(row.join(" │ "), color));
    }
    console.log(sep);
    console.log(
        pad("TOTAL", widths[0]) +
            " │ " +
            pad(formatKB(totals.size), widths[1], true) +
            " │ " +
            pad(formatKB(totals.gzip), widths[2], true) +
            " │ " +
            pad(
                baseline
                    ? formatDelta(
                          totals.gzip,
                          Object.values(baseline.files).reduce(
                              (sum, f) => sum + f.gzip,
                              0,
                          ),
                      )
                    : "—",
                widths[3],
                true,
            ),
    );

    printChangeSummary(entries, baseline, maxDeltaPercent);

    if (entries.length > topN) {
        console.log(
            colorize(
                `...${entries.length - topN} smaller files omitted (--top ${topN})`,
                "gray",
            ),
        );
    }

    const baselineGroups = baselineGroupsFromFiles(baseline);
    const groupRows = Object.entries(groups).map(([name, group]) => {
        const base = baselineGroups?.[name];
        return [
            name,
            String(group.files),
            formatKB(group.gzip),
            base?.gzip ? formatDelta(group.gzip, base.gzip) : "—",
        ];
    });
    const groupHead = ["Group", "Files", "Size (gz)", "Δ gz vs baseline"];
    const groupWidths = groupHead.map((h, i) =>
        Math.max(h.length, ...groupRows.map((r) => r[i].length)),
    );
    const groupSep = "─".repeat(
        groupWidths.reduce((a, b) => a + b, 0) + (groupWidths.length - 1) * 3,
    );
    console.log("");
    console.log(groupSep);
    console.log(
        groupHead.map((h, i) => pad(h, groupWidths[i], i > 0)).join(" │ "),
    );
    console.log(groupSep);
    for (const row of groupRows) {
        const base = baselineGroups?.[row[0]];
        const actual = groups[row[0]].gzip;
        const deltaPct = base?.gzip
            ? ((actual - base.gzip) / base.gzip) * 100
            : 0;
        if (base?.gzip && deltaPct > maxDeltaPercent) overBudget++;
        const color = !base
            ? "gray"
            : Math.abs(deltaPct) < 1
              ? "gray"
              : deltaPct > maxDeltaPercent
                ? "red"
                : deltaPct > 0
                  ? "yellow"
                  : "green";
        console.log(
            colorize(
                [
                    pad(row[0], groupWidths[0]),
                    pad(row[1], groupWidths[1], true),
                    pad(row[2], groupWidths[2], true),
                    pad(row[3], groupWidths[3], true),
                ].join(" │ "),
                color,
            ),
        );
    }
    console.log(groupSep);

    if (!baseline) {
        console.log("");
        console.log(
            colorize(
                "No baseline found. Run with --update-baseline to record current sizes.",
                "gray",
            ),
        );
    }

    if (overBudget > 0) {
        console.error("");
        console.error(
            colorize(
                `❌ ${overBudget} file/group budget(s) exceed +${maxDeltaPercent}% gzip budget vs baseline.`,
                "red",
            ),
        );
        process.exit(1);
    }

    function printChangeSummary(entries, baseline, maxPct) {
        if (!baseline) return;
        const changes = summarizeBaselineChanges(entries, baseline, maxPct);
        console.log("");
        console.log("Change summary vs baseline:");
        printChangeLine("Added", changes.added);
        printChangeLine("Removed", changes.removed);
        printDeltaLine("Over budget growth", changes.grown);
        printDeltaLine("Shrunk", changes.shrunk);
    }

    function printChangeLine(label, entries) {
        if (entries.length === 0) {
            console.log(`  ${label}: none`);
            return;
        }
        console.log(
            `  ${label}: ${entries
                .slice(0, 5)
                .map((entry) => `${entry.relative} (${formatKB(entry.gzip)} gzip)`)
                .join(", ")}${entries.length > 5 ? `, +${entries.length - 5} more` : ""}`,
        );
    }

    function printDeltaLine(label, entries) {
        if (entries.length === 0) {
            console.log(`  ${label}: none`);
            return;
        }
        console.log(
            `  ${label}: ${entries
                .slice(0, 5)
                .map((entry) => `${entry.relative} (${formatDelta(entry.gzip, entry.baselineGzip)})`)
                .join(", ")}${entries.length > 5 ? `, +${entries.length - 5} more` : ""}`,
        );
    }
}
