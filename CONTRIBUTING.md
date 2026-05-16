# Contributing to AI Assistant SDK

Thanks for considering a contribution. This guide is intentionally short — for
deep architecture material, please read
[`docs/guide/backend-architecture.md`](docs/guide/backend-architecture.md) and
[`docs/guide/configuration.md`](docs/guide/configuration.md) first.

> If you only need to file an issue, jump to
> [Filing issues](#filing-issues). Otherwise read on for the development loop.

## Repository layout (one-line per module)

```text
ai-assistant-server/          Spring Boot 3 Starter — the core capabilities library
ai-assistant-service/         Independent Docker service that re-exposes the Starter
ai-assistant-client/          Java client SDK
ai-assistant-ui/              @ai-assistant/vue — the Vue 3 component library
ai-assistant-vue-playground/  Local sandbox / demo for the Vue library
docs/                         VitePress documentation site
e2e/                          Playwright end-to-end tests
helm/                         Kubernetes Helm chart
deploy/                       nginx / Caddy reverse-proxy examples
integrations/                 Third-party integration samples
scripts/                      Health checks, version-consistency, release, smoke tests
.github/                      CI workflows, dependabot, CODEOWNERS, release config
```

## Local setup (one-time)

You need: Java 21+, Maven 3.9+, Node 20+ LTS, npm 10+. Docker is optional unless
you want to validate the standalone service.

```bash
# Backend: aggregator install (skips tests; do this once)
mvn -B -DskipTests install

# Frontend
cd ai-assistant-ui && npm install && cd ..
cd ai-assistant-vue-playground && npm install && cd ..

# E2E (only if you plan to run Playwright)
cd e2e && npm install && npx playwright install && cd ..

# Install git pre-commit hook (highly recommended; runs lint + format check)
node scripts/install-git-hooks.mjs
```

## The development loop

We follow a "small, frequent, verified" cadence:

1. **Pick a unit of work**. New features get a `K<number>` tag (next free
   integer; e.g. `K56`, `K57`). Bug fixes do not need a `K` tag.
2. **Implement** — composables, modules, tests, i18n, styles. Keep the
   single-commit scope tight.
3. **Self-verify** with the relevant slice (see [Verification](#verification)).
4. **Commit** with a [conventional message](#commit-messages). The pre-commit
   hook will block formatting / lint regressions.
5. **Push to a branch and open a PR**. CI runs lint, tests, build, OWASP
   Dependency-Check, npm audit, Trivy, and the bundle-size guard.
6. **CODEOWNERS approval** is required before merge (see `.github/CODEOWNERS`).
7. **Squash-merge** by default; preserve the conventional title.

## Verification

These are the fastest commands per slice. CI runs the union of all of them.

```bash
# Frontend lint + format + unit tests + library build + types
cd ai-assistant-ui
npm run lint           # ESLint — must be 0 errors
npm run format:check   # Prettier — must report no diffs
npm test               # Vitest — must be all green
npm run build:lib      # Library bundle — must succeed
npx vue-tsc --noEmit   # Type check — must be 0 errors

# Bundle-size guard (compares against scripts/.bundle-size-baseline.json)
node scripts/bundle-size-check.mjs

# Backend unit tests
cd ai-assistant-server
mvn -B test            # JUnit 5 — must be all green
mvn -B spotless:check  # google-java-format — must report no diffs

# Documentation site
cd docs
npm ci && npm run build  # VitePress — must succeed, no language warnings

# Aggregate health check (runs version consistency + docs build)
node scripts/project-health-check.mjs --docs
```

For the **complete** matrix:

```bash
node scripts/project-health-check.mjs --all
```

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Examples
from the repository history:

```text
feat(ui): K47 - all-columns view in CompareRegionsDialog (N parallel cols + synced scroll)
feat(server): K53.1 - split LlmService.callLlmStream into StreamingLlmCallExecutor
refactor(ui): K53.2 - extract useExportProgress, shrink useExportActions to payload-builder
fix(ui): pin lib-mode css output filename to style.css
test(e2e): K53.3 - usePromptHistory recall/persistence/escape coverage
ci(release): K51 - soft NPM_TOKEN check in preflight (graceful skip publish-npm)
docs: K50 - prepend v1.0.2 release notes for K36-K48 wave to CHANGELOG.md
```

Rules:

* Use one of `feat | fix | refactor | test | docs | style | perf | chore | ci | build`.
* Scope is the touched module: `ui`, `server`, `service`, `client`, `playground`,
  `e2e`, `docs`, `scripts`, `infra`. Omit if the change spans multiple.
* For features and refactors, include the `K<number>` tag after the colon.
* First line ≤ 100 characters. Body (optional) explains the *why* and any
  follow-up consequences; wrap at ~80 chars.

## Pull requests

Open a PR against `main` from a feature branch named with the same scope:

```text
feat/K57-mcp-streaming
fix/sse-windows-line-endings
refactor/llm-service-pipeline
```

PR checklist (the CI template enforces most of these):

* [ ] CI is green
* [ ] CODEOWNERS approval present
* [ ] Bundle size delta is acceptable (CI will block > +10% gzip)
* [ ] New code has unit tests where reasonable
* [ ] User-facing strings are translated in all four locales
  (`utils/i18n/{en,zh,ja,ko}.ts` + `types.ts`)
* [ ] If the public API changed: `ai-assistant-ui/src/index.ts` exports updated,
      `docs/api/` updated, CHANGELOG entry added
* [ ] If a server endpoint or `ChatRequest` field changed: front-end
      `utils/api.ts` updated, contract tests adjusted
* [ ] If a new config property was added: `application.yml`, `.env.example`,
      `docs/guide/configuration.md` all updated

The pre-commit hook will fail your `git commit` until lint and formatting pass.
If you must bypass once (e.g. emergency hotfix), use
`git commit --no-verify` and **immediately follow up** with a `style:`
commit that restores compliance.

## Branch protection (recommended for `main`)

These are the rules we recommend you enable on GitHub under
`Settings → Branches → Branch protection rules` for `main`:

* Require a pull request before merging
  * Require approvals: **1**
  * Dismiss stale approvals on push
  * **Require review from Code Owners** (enforces `.github/CODEOWNERS`)
* Require status checks to pass before merging
  * `ci / lint-test-build`
  * `ci / frontend-tests`
  * `ci / backend-tests`
  * `ci / bundle-size-check`
  * `ci / dependency-check`
  * `ci / trivy`
* Require branches to be up to date before merging
* Require conversation resolution before merging
* Do not allow bypassing the above settings (off for admins)
* Disable force-push and deletion on `main`

Once a second maintainer joins, also enable "Require approvals from at least
1 user outside of the author's organization" if applicable.

## Release process

```bash
# Bumps pom.xml × 3 + package.json × 2 + lock + CHANGELOG, then tags
node scripts/release.mjs patch  # or minor / major

git push --follow-tags
```

The published GitHub release ("`Release v1.x.y` → Publish") triggers
`publish.yml` which pushes to npmjs.org and GHCR. Pushing the tag alone does
**not** publish, which is intentional.

For details see `docs/guide/deployment-checklists.md`.

## Filing issues

* Bug: please include a minimal reproduction, version (`pom.xml` / `package.json`),
  the `chat / runtime/config` response (sanitized), and browser / JVM version.
* Feature request: please describe the user problem first, then the proposed
  shape. We try to keep the SDK opinion-free at the wire-format level; new
  capabilities usually land as composables or `ChatCompletionClient`
  implementations rather than as new endpoints.
* Security: see `SECURITY.md` (or open a private security advisory on GitHub).

## Where new code goes

When you have a feature in mind, the routing rule of thumb is:

| The change is mostly… | Land it in… |
|---|---|
| A new HTTP route the server should expose | `ai-assistant-server/.../controller/` |
| Business orchestration logic (prompt assembly, RAG, agents) | `ai-assistant-server/.../service/` |
| A new LLM provider | a new `ChatCompletionClient` implementation, register via `@ConditionalOnMissingBean` |
| A new safety / quota / audit rule | `ai-assistant-server/.../security/` or `audit/` or `stats/` |
| A reusable client-side capability (no DOM) | a new composable under `ai-assistant-ui/src/composables/` |
| A specific UI piece | a new Vue component under `ai-assistant-ui/src/components/` |
| A new visual layer | a new `NN-name.css` slice under `ai-assistant-ui/src/components/styles/` — but please first see if existing token-level changes would do |
| A connector to an external data system | a new `DataConnector` under `ai-assistant-server/.../connector/` |
| Cross-cutting documentation | a new page under `docs/guide/` or `docs/api/` with a link from `docs/.vitepress/config.ts` |

When in doubt, open a draft PR with an outline and tag a maintainer for
direction before writing the full implementation. We optimise for fast
direction, not for upfront design docs.
