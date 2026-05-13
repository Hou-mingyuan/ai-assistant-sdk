# Git Hooks（pre-commit 本地保护）

为了避免「lint 失败 / 格式不对 / 版本号忘了 bump」这类 CI 红牌等到 push 后才发现，
仓库提供了一个**轻量、可选、零依赖**的 pre-commit hook。

## 一键安装

```bash
node scripts/install-git-hooks.mjs
```

完成后：

- `.git/hooks/pre-commit` 写入了一个 POSIX shim，里面带 `# ai-assistant-sdk:managed-hook` 标记。
- shim 调用 `scripts/git-hooks/pre-commit.mjs`，真正的检查逻辑在 .mjs 里。
- 重复运行 installer 是幂等的：检测到自家 shim 会跳过；检测到陌生 hook **拒绝覆盖**（用 `--force` 才会强制）。

跨平台说明：

- **Linux/macOS**：原生 sh 跑 shim。
- **Windows**：Git for Windows 自带的 Git Bash 跑 shim，**不需要额外安装 WSL**。

## 跑了哪些检查

| 类型                                        | 行为                                                                    | 失败结果       |
| ------------------------------------------- | ----------------------------------------------------------------------- | -------------- |
| `ai-assistant-ui/src/**/*.{ts,vue,css,json}` | `npm run lint` + `npm run format:check`                                 | 阻止 commit    |
| `scripts/**/*.mjs`                          | `node --check <file>`（语法校验）                                       | 阻止 commit    |
| 任意 `package.json` / `pom.xml`             | `node scripts/check-version-consistency.mjs`                            | 阻止 commit    |
| `ai-assistant-server/**/*.java`             | **默认仅警告 + 打印命令**；冷启动 mvn 15-30s 体验差，所以不强行跑       | 警告（不阻止） |

> ⚠️ 不会跑：单元测试、e2e、docker 校验、`mvn test`。这些有 CI 兜底，本地 commit 要快。

## 启用 server-side spotless 自动校验（可选）

如果你**正在专心修 server java 文件**且能接受多等 15-30s：

```bash
# bash / zsh
export AI_ASSISTANT_HOOK_SPOTLESS=1

# Windows PowerShell
$env:AI_ASSISTANT_HOOK_SPOTLESS = '1'
```

设置后 hook 会自动跑：

```bash
mvn -B -q spotless:check -f ai-assistant-server/pom.xml -DspotlessFiles=<staged-files>
```

失败时打印修复命令：

```bash
mvn spotless:apply -f ai-assistant-server/pom.xml
```

> 💡 大多数前端协作时不需要打开这个开关 —— CI ci.yml 的 `spotless:check` 仍兜底，
> 错过的本地格式问题最多让 PR 红牌一次而已，不会污染主分支。

## 临时绕过 hook

某次 commit 想跳过（如 typo 单字修复、紧急 revert）：

```bash
git commit --no-verify
```

## 卸载

```bash
node scripts/install-git-hooks.mjs --uninstall
```

只在确认安装的 hook 是本脚本管理的（即带 `# ai-assistant-sdk:managed-hook` 标记）时才会删。
如果你手写过 `.git/hooks/pre-commit`，需要加 `--force` 强删。

## FAQ

**Q：会动我已经写好的其他 hook 吗（如 pre-push / commit-msg）？**
A：不会。本脚本只动 `pre-commit`，且发现非本脚本的 hook 会拒绝覆盖。

**Q：能不能配置只跑 lint 跳过 format:check？**
A：编辑 `scripts/git-hooks/pre-commit.mjs` 即可，逻辑就那 100 行。
不走 husky / lint-staged 是有意为之 —— 减依赖、源码透明、便于审计。

**Q：CI 上要不要也跑这个？**
A：不必。CI 在 `.github/workflows/ci.yml` 里有完整的 lint / format / build / test / spotless / checkstyle / bundle-size 工序，
本 hook 只是本地的「最后一道墙」。

**Q：fork / clone 后 hook 自动安装吗？**
A：默认**不会**。需要 clone 后手动跑一次 `node scripts/install-git-hooks.mjs`。
之所以不走 `package.json` 的 `prepare` 字段，是因为它要求安装位置和 .git 目录同级，
本仓库 monorepo 结构（`ai-assistant-ui/package.json` 与 `.git` 不在同一级）不满足条件，
强行写会在 npm publish 时被打包上去导致干扰下游。

## 配套：覆盖率回归门槛

`coverage-check.mjs` 与本 hook 互补 —— hook 在 commit 前快速兜底，
coverage 检查在 CI 里跑完整的回归对比，捕捉**小幅但持续**的覆盖率下滑。

| 层 | 工具 | 触发时机 | 检测维度 |
| --- | --- | --- | --- |
| 1. 地板（绝对值） | vitest `thresholds` 配置 | 本地 `npm run test:coverage` & CI | 整体降到死线以下即 fail |
| 2. 回归（相对值） | `scripts/coverage-check.mjs` | CI 跑完 coverage 后 | 任一文件 / TOTAL 下降 > 阈值（默认 1pt）即 fail |

### 本地手动跑

```bash
# 跑测试 + 生成 coverage/coverage-summary.json
cd ai-assistant-ui && npm run test:coverage && cd -

# 与 baseline 对比
node scripts/coverage-check.mjs

# 调整容忍度（更严格 / 更宽松）
node scripts/coverage-check.mjs --max-drop-percent 0.5
node scripts/coverage-check.mjs --max-drop-percent 2.5

# 当前提升是真实的且要被未来 PR 守护：把 baseline 推上去
node scripts/coverage-check.mjs --update-baseline
git add scripts/.coverage-baseline.json
```

### 与 project-health-check 集成

```bash
# 单独跑（前提：已经有 coverage-summary.json）
node scripts/project-health-check.mjs --coverage

# --all 自动 build + test:coverage + bundle-size + coverage-check
node scripts/project-health-check.mjs --all
```

### CI 自动评论到 PR

`bundle-size-check` 和 `coverage-check` 都支持 `--markdown` / `--markdown-out` 参数，
CI workflow 在 PR 上跑完后自动把两个报表拼成一条**贴顶评论**（sticky comment，复用同一条 issue comment）：

```
<!-- ci-metrics-sticky -->

### 📦 Bundle Size Report
...

### 🧪 Coverage Report
...
```

实现细节：

- 检测 PR 上是否已经有带 `<!-- ci-metrics-sticky -->` 标记的评论 —— 有则 update、无则 create。
- 用 `actions/github-script@v7`，不依赖任何第三方 action（审计友好）。
- 需要工作流权限 `pull-requests: write`（仅在 `frontend` job 内开启）。
- push 到 main 不发评论（GitHub Actions `if: github.event_name == 'pull_request'`）。

本地预览同样的 markdown：

```bash
node scripts/bundle-size-check.mjs --markdown
node scripts/coverage-check.mjs --markdown
```

## 相关文件

- `scripts/install-git-hooks.mjs` — 安装器（含 `--force` / `--uninstall`）
- `scripts/git-hooks/pre-commit.mjs` — 实际跑的检查逻辑
- `scripts/coverage-check.mjs` — 覆盖率回归检测（J2，含 `--markdown`）
- `scripts/.coverage-baseline.json` — 覆盖率基线快照
- `scripts/bundle-size-check.mjs` — bundle gzip 守门（F2，含 `--markdown`，J1）
- `scripts/.bundle-size-baseline.json` — bundle 基线快照
- `.github/workflows/ci.yml` — CI 兜底 + PR sticky comment（spotless / coverage / e2e / bundle-size）
- [Production Checklist](./production-checklist.md) — 发版前完整 checklist
