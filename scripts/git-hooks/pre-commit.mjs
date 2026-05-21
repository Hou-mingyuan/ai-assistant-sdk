#!/usr/bin/env node
/**
 * pre-commit hook
 * ---------------
 * 安装方式：`node scripts/install-git-hooks.mjs`
 * 临时跳过：`git commit --no-verify`
 *
 * 设计原则
 * --------
 * 1. **零误改**：所有检查都是 read-only，不写文件、不动 stage。
 * 2. **按 staged 范围做最少功**：哪类文件没动，对应检查直接跳过。
 * 3. **冷启动慢的检查（mvn / docker）默认不跑**，但打印一行精准命令让用户手动跑；
 *    CI 仍兜底，本地体验 < 5s。
 *
 * 实际跑的检查（按 staged 文件类型自动跳过无关项）
 * --------------------------------------------------
 *   类型                                          检查                                        失败行为
 *   ----                                          ----                                        ----
 *   frontend (.ts/.vue/.css under ai-assistant-ui/) → `npm run lint`                           block commit
 *                                                  → `npm run format:check`                   block commit
 *   server (.java under ai-assistant-server/)     → 默认仅警告 + 打印 `mvn spotless:apply` 命令
 *                                                   设 `AI_ASSISTANT_HOOK_SPOTLESS=1` 启用真跑  block commit
 *   scripts (.mjs under scripts/)                 → `node --check <file>`                     block commit
 *   manifest (package.json / pom.xml)             → `check-version-consistency.mjs`           block commit
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: 'utf-8', stdio: 'pipe', ...opts });
}

function shInherit(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

function color(text, c) {
  if (process.env.NO_COLOR || !process.stdout.isTTY) return text;
  const codes = { red: 31, green: 32, yellow: 33, cyan: 36, gray: 90 };
  return `\x1b[${codes[c] ?? 0}m${text}\x1b[0m`;
}

function quoteShellArg(value) {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

const staged = sh('git diff --cached --name-only --diff-filter=ACMR')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

if (staged.length === 0) {
  /* 没 staged 的文件（如 `git commit --amend --no-edit`）就跳过 */
  process.exit(0);
}

const frontendFiles = staged.filter(
  (f) => f.startsWith('ai-assistant-ui/src/') && /\.(ts|vue|css|json)$/.test(f),
);
const frontendFilesForTooling = frontendFiles.map((f) =>
  quoteShellArg(f.replace(/^ai-assistant-ui\//, '')),
);
const serverJavaFiles = staged.filter(
  (f) => f.startsWith('ai-assistant-server/') && f.endsWith('.java'),
);
const scriptFiles = staged.filter((f) => f.startsWith('scripts/') && f.endsWith('.mjs'));
const manifestFiles = staged.filter(
  (f) => f.endsWith('package.json') || f.endsWith('pom.xml'),
);

let failures = 0;

console.log(color('› pre-commit hook running…', 'cyan'));
console.log(
  color(
    `  staged: ${staged.length} file(s) | frontend=${frontendFiles.length} server=${serverJavaFiles.length} scripts=${scriptFiles.length} manifest=${manifestFiles.length}`,
    'gray',
  ),
);

if (scriptFiles.length > 0) {
  console.log(color(`  ✓ syntax check (${scriptFiles.length} .mjs)…`, 'gray'));
  for (const f of scriptFiles) {
    try {
      sh(`node --check "${path.join(root, f)}"`);
    } catch (e) {
      console.error(color(`✗ Syntax error in ${f}`, 'red'));
      console.error(e.stdout?.toString() || '');
      console.error(e.stderr?.toString() || '');
      failures++;
    }
  }
}

if (frontendFiles.length > 0) {
  console.log(color('  ✓ frontend lint (eslint)…', 'gray'));
  try {
    shInherit(`npx eslint ${frontendFilesForTooling.join(' ')}`, {
      cwd: path.join(root, 'ai-assistant-ui'),
    });
  } catch {
    failures++;
  }

  console.log(color('  ✓ frontend format (prettier --check)…', 'gray'));
  try {
    shInherit(`npx prettier --check ${frontendFilesForTooling.join(' ')}`, {
      cwd: path.join(root, 'ai-assistant-ui'),
    });
  } catch {
    console.error(
      color(
        '  Fix with: cd ai-assistant-ui && npm run format',
        'gray',
      ),
    );
    failures++;
  }
}

if (manifestFiles.length > 0) {
  console.log(color('  ✓ version consistency…', 'gray'));
  try {
    sh('node scripts/check-version-consistency.mjs');
  } catch (e) {
    console.error(color('✗ version consistency failed:', 'red'));
    console.error(e.stdout?.toString() || '');
    failures++;
  }
}

if (serverJavaFiles.length > 0) {
  const wantSpotless = process.env.AI_ASSISTANT_HOOK_SPOTLESS === '1';

  if (wantSpotless) {
    console.log(
      color(
        `  ✓ server spotless:check (${serverJavaFiles.length} .java, ~15-30s JVM cold start)…`,
        'gray',
      ),
    );
    try {
      const fileArg = serverJavaFiles.map((f) => path.join(root, f)).join(',');
      shInherit(
        `mvn -B -q spotless:check -f ai-assistant-server/pom.xml -DspotlessFiles=${fileArg}`,
      );
    } catch {
      console.error(
        color(
          '  Fix with: mvn spotless:apply -f ai-assistant-server/pom.xml',
          'gray',
        ),
      );
      failures++;
    }
  } else {
    console.log(
      color(
        `  ⚠ server .java staged (${serverJavaFiles.length}) — spotless NOT auto-run (mvn cold start ~15-30s).`,
        'yellow',
      ),
    );
    console.log(
      color(
        '    Recommended (manual, before push):',
        'yellow',
      ),
    );
    console.log(
      color(
        '      mvn spotless:apply -f ai-assistant-server/pom.xml',
        'cyan',
      ),
    );
    console.log(
      color(
        '    To enable auto-check in pre-commit: export AI_ASSISTANT_HOOK_SPOTLESS=1',
        'gray',
      ),
    );
    console.log(
      color(
        '    (CI ci.yml runs spotless:check unconditionally, so anything missed locally will still be caught before merge.)',
        'gray',
      ),
    );
  }
}

if (failures > 0) {
  console.error(color(`\n✗ pre-commit hook failed with ${failures} error(s).`, 'red'));
  console.error(color('  Bypass once: git commit --no-verify', 'gray'));
  process.exit(1);
}

console.log(color('✓ pre-commit OK', 'green'));
