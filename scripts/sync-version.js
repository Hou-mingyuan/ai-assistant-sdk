#!/usr/bin/env node
/**
 * Sync version across npm package files and Maven module POMs.
 * Usage:
 *   node scripts/sync-version.js 1.2.3
 *   node scripts/sync-version.js 1.2.3 --release
 */
const fs = require('fs')
const path = require('path')

const version = process.argv[2]
const releaseMode = process.argv.includes('--release')
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/sync-version.js <version> [--release]')
  process.exit(1)
}

const releaseVersion = version.replace(/-SNAPSHOT$/, '')
const mavenVersion = releaseMode
  ? releaseVersion
  : version.endsWith('-SNAPSHOT') ? version : `${version}-SNAPSHOT`

syncPackageJson('../ai-assistant-ui/package.json', releaseVersion)
syncPackageLock('../ai-assistant-ui/package-lock.json', releaseVersion)
syncPackageJson('../ai-assistant-vue-playground/package.json', releaseVersion)
syncPackageLock('../ai-assistant-vue-playground/package-lock.json', releaseVersion)

syncPomProjectVersion('../pom.xml', mavenVersion)
syncPomProjectVersion('../ai-assistant-server/pom.xml', mavenVersion)
syncPomProjectVersion('../ai-assistant-service/pom.xml', mavenVersion)
syncPomProjectVersion('../ai-assistant-client/pom.xml', mavenVersion)
syncPomProjectVersion('../ai-assistant-demo/pom.xml', mavenVersion)
syncPomParentVersion('../ai-assistant-observability-support/pom.xml', mavenVersion)
syncEmbeddedVersion('../helm/ai-assistant/Chart.yaml', /(appVersion:\s*")[^"]+(")/, releaseVersion)
syncEmbeddedVersion('../helm/ai-assistant/values.yaml', /(\n\s*tag:\s*")[^"]+(")/, releaseVersion)
syncEmbeddedVersion('../ai-assistant-server/src/main/java/com/aiassistant/mcp/McpServerController.java', /(SERVER_VERSION\s*=\s*")[^"]+(")/, releaseVersion)
syncEmbeddedVersion('../ai-assistant-server/src/main/java/com/aiassistant/config/OpenApiConfiguration.java', /(\.version\(")[^"]+("\))/, releaseVersion)
syncEmbeddedVersion('../ai-assistant-observability-support/src/main/java/com/aiassistant/autoconfigure/AiAssistantOpenApiAutoConfiguration.java', /(\.version\(")[^"]+("\))/, releaseVersion)

console.log(`npm packages → ${releaseVersion}`)
console.log(`Maven modules → ${mavenVersion}`)
console.log(`mode → ${releaseMode ? 'release' : 'snapshot'}`)

function syncPackageJson(relativePath, nextVersion) {
  const file = path.resolve(__dirname, relativePath)
  const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'))
  pkg.version = nextVersion
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
}

function syncPackageLock(relativePath, nextVersion) {
  const file = path.resolve(__dirname, relativePath)
  if (!fs.existsSync(file)) return
  const lock = JSON.parse(fs.readFileSync(file, 'utf-8'))
  if (lock.version) lock.version = nextVersion
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = nextVersion
  }
  fs.writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`)
}

function syncPomProjectVersion(relativePath, nextVersion) {
  const file = path.resolve(__dirname, relativePath)
  let pom = fs.readFileSync(file, 'utf-8')
  const parentMatch = pom.match(/<parent>[\s\S]*?<\/parent>/)
  const parentPlaceholder = '__AI_ASSISTANT_PARENT_POM_BLOCK__'
  const editablePom = parentMatch ? pom.replace(parentMatch[0], parentPlaceholder) : pom
  const updatedPom = editablePom.replace(
    /(<artifactId>[^<]+<\/artifactId>\s*<version>)[^<]+(<\/version>)/,
    `$1${nextVersion}$2`,
  )
  pom = updatedPom
    .replace(parentPlaceholder, parentMatch?.[0] ?? '')
    .replace(
      /(<ai-assistant\.version>)[^<]+(<\/ai-assistant\.version>)/,
      `$1${nextVersion}$2`,
    )
  fs.writeFileSync(file, pom)
}

function syncPomParentVersion(relativePath, nextVersion) {
  const file = path.resolve(__dirname, relativePath)
  const pom = fs.readFileSync(file, 'utf-8')
  const pattern =
    /(<parent>[\s\S]*?<artifactId>ai-assistant-sdk<\/artifactId>\s*<version>)[^<]+(<\/version>[\s\S]*?<\/parent>)/
  if (!pattern.test(pom)) {
    throw new Error(`Unable to update AI Assistant parent version in ${relativePath}`)
  }
  fs.writeFileSync(file, pom.replace(pattern, `$1${nextVersion}$2`))
}

function syncEmbeddedVersion(relativePath, pattern, nextVersion) {
  const file = path.resolve(__dirname, relativePath)
  const content = fs.readFileSync(file, 'utf-8')
  if (!pattern.test(content)) {
    throw new Error(`Unable to update embedded version in ${relativePath}`)
  }
  fs.writeFileSync(
    file,
    content.replace(pattern, (_match, prefix, suffix) => `${prefix}${nextVersion}${suffix}`),
  )
}
