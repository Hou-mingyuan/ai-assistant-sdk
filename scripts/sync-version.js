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

syncPomProjectVersion('../ai-assistant-server/pom.xml', mavenVersion)
syncPomProjectVersion('../ai-assistant-service/pom.xml', mavenVersion)
syncPomProjectVersion('../ai-assistant-client/pom.xml', mavenVersion)

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
  pom = updatedPom.replace(parentPlaceholder, parentMatch?.[0] ?? '')
  fs.writeFileSync(file, pom)
}
