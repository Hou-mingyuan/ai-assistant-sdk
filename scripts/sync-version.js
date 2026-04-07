#!/usr/bin/env node
/**
 * Sync version across package.json and pom.xml.
 * Usage: node scripts/sync-version.js 1.2.3
 */
const fs = require('fs')
const path = require('path')

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node scripts/sync-version.js <version>')
  process.exit(1)
}

const pkgPath = path.resolve(__dirname, '../ai-assistant-ui/package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
pkg.version = version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`package.json → ${version}`)

const pomPath = path.resolve(__dirname, '../ai-assistant-server/pom.xml')
let pom = fs.readFileSync(pomPath, 'utf-8')
pom = pom.replace(
  /(<artifactId>ai-assistant-spring-boot-starter<\/artifactId>\s*<version>)[^<]+(.*)/,
  `$1${version}-SNAPSHOT$2`
)
fs.writeFileSync(pomPath, pom)
console.log(`pom.xml → ${version}-SNAPSHOT`)
