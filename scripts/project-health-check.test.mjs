import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('release-check builds the frontend before reading bundle dist output', async () => {
  const source = await readFile('scripts/project-health-check.mjs', 'utf8')

  const buildStep = source.indexOf("name: 'frontend build (for release-check bundle baseline)'")
  const bundleStep = source.indexOf("name: 'bundle size watchdog'")

  assert.notEqual(buildStep, -1)
  assert.notEqual(bundleStep, -1)
  assert.ok(buildStep < bundleStep)
  assert.match(source, /if \(runReleaseCheckFull\)[\s\S]*?args: \['run', 'build'\]/)
})

test('release-check reports support dependency boundaries', async () => {
  const source = await readFile('scripts/project-health-check.mjs', 'utf8')

  assert.match(source, /const runSupportDependencyReport =/)
  assert.match(source, /name: 'support dependency boundary report'/)
  assert.match(source, /support-dependency-report\.mjs/)
})

test('release-check has fast and full lanes', async () => {
  const source = await readFile('scripts/project-health-check.mjs', 'utf8')

  assert.match(source, /const runReleaseCheckFast = args\.has\('--release-check-fast'\)/)
  assert.match(source, /const runReleaseCheckFull = args\.has\('--release-check-full'\) \|\| runReleaseCheck/)
  assert.match(source, /--release-check-fast/)
  assert.match(source, /--release-check-full/)
})

test('local-verify lane covers frontend build and backend package', async () => {
  const source = await readFile('scripts/project-health-check.mjs', 'utf8')

  assert.match(source, /const runLocalVerify = args\.has\('--local-verify'\)/)
  assert.match(source, /name: 'frontend build \(local verify\)'/)
  assert.match(source, /name: 'backend service package \(local verify\)'/)
  assert.match(source, /--local-verify/)
})

test('compact chat search styles preserve mobile touch target variables', async () => {
  const source = await readFile(
    'ai-assistant-ui/src/components/styles/99-enterprise-overhaul.css',
    'utf8',
  )

  assert.match(source, /--ai-search-input-height: 44px/)
  assert.match(source, /--ai-search-nav-size: 44px/)
  assert.match(
    source,
    /\.ai-chat-search-input \{\s+height: var\(--ai-search-input-height, 26px\) !important;\s+min-height: var\(--ai-search-input-height, 26px\) !important;/,
  )
  assert.match(
    source,
    /\.ai-search-nav,\s+\.ai-assistant-wrapper\.ai-assistant-wrapper\.ai-assistant-wrapper \.ai-search-options-toggle \{\s+height: var\(--ai-search-nav-size, 26px\) !important;\s+min-height: var\(--ai-search-nav-size, 26px\) !important;/,
  )
})

test('Admin tabs switch to a non-scrolling grid at tablet and mobile breakpoints', async () => {
  const source = await readFile(
    'ai-assistant-vue-playground/src/AdminDemoPanel.vue',
    'utf8',
  )

  assert.match(
    source,
    /@media \(max-width: 820px\) \{[\s\S]*?\.admin-app-tabs \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);[\s\S]*?overflow-x: visible;/,
  )
  assert.match(
    source,
    /@media \(max-width: 700px\) \{[\s\S]*?\.admin-app-tabs \{\s+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  )
})

test('Spring Boot artifacts exclude PDFBox commons-logging in favor of spring-jcl', async () => {
  for (const pomPath of ['ai-assistant-server/pom.xml', 'ai-assistant-demo/pom.xml']) {
    const pom = await readFile(pomPath, 'utf8')
    const pdfboxDependency = pom.match(
      /<dependency>\s*<groupId>org\.apache\.pdfbox<\/groupId>\s*<artifactId>pdfbox<\/artifactId>[\s\S]*?<\/dependency>/,
    )?.[0]

    assert.ok(pdfboxDependency, `${pomPath} must declare PDFBox`)
    assert.match(pdfboxDependency, /<groupId>commons-logging<\/groupId>/)
    assert.match(pdfboxDependency, /<artifactId>commons-logging<\/artifactId>/)
  }
})

test('CI OWASP scan uses reviewed, precise, time-bounded suppressions', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8')
  const suppressions = await readFile('.github/owasp-suppressions.xml', 'utf8')

  assert.match(workflow, /-DsuppressionFiles=\.github\/owasp-suppressions\.xml/)
  assert.match(
    suppressions,
    /<suppressions xmlns="https:\/\/jeremylong\.github\.io\/DependencyCheck\/dependency-suppression\.1\.3\.xsd">/,
  )

  const suppressionOpeningTags = [
    ...suppressions.matchAll(/<suppress(?=\s|>)([^>]*)>/g),
  ]
  const suppressionEntries = [
    ...suppressions.matchAll(/<suppress(?=\s|>)([^>]*)>[\s\S]*?<\/suppress>/g),
  ]
  assert.equal(suppressionEntries.length, suppressionOpeningTags.length)
  assert.equal(suppressionEntries.length, 1)
  for (const [, attributes] of suppressionOpeningTags) {
    const until = attributes.match(/\buntil="([^"]+)"/)?.[1]
    assert.ok(until, 'every OWASP suppression must have an expiry date')
    assert.ok(
      Date.parse(until) > Date.now(),
      `OWASP suppression expired on ${until}; remove or re-review it`,
    )
  }

  assert.match(suppressions, /Reviewed 2026-07-22/)
  assert.deepEqual(
    [...suppressions.matchAll(/<cve>([^<]+)<\/cve>/g)].map((match) => match[1]),
    ['CVE-2020-29582', 'CVE-2026-53914'],
  )
  assert.ok(
    suppressions.includes(
      '<packageUrl regex="true">^pkg:maven/org\\.jetbrains\\.kotlin/kotlin-stdlib(?:-(?:common|jdk[78]))?@1\\.9\\.25$</packageUrl>',
    ),
    'the reviewed Kotlin exceptions must use the exact package URL regex',
  )
  assert.doesNotMatch(suppressions, /<cpe(?=\s|>)/)
})
