#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const mavenModules = [
  'ai-assistant-server/pom.xml',
  'ai-assistant-service/pom.xml',
  'ai-assistant-client/pom.xml',
]

const npmPackages = [
  'ai-assistant-ui/package.json',
]

const errors = []
const mavenVersions = new Map()
const npmVersions = new Map()

for (const file of mavenModules) {
  const version = readMavenProjectVersion(file)
  mavenVersions.set(file, version)
}

for (const file of npmPackages) {
  const version = readJson(file).version
  npmVersions.set(file, version)
}

const uniqueMavenVersions = new Set(mavenVersions.values())
if (uniqueMavenVersions.size !== 1) {
  errors.push(`Maven module versions differ: ${formatMap(mavenVersions)}`)
}

const mavenVersion = [...uniqueMavenVersions][0]
const releaseVersion = mavenVersion?.replace(/-SNAPSHOT$/, '')

for (const [file, version] of npmVersions) {
  if (version !== releaseVersion) {
    errors.push(`${file} version ${version} does not match Maven release version ${releaseVersion}`)
  }
}

const uiLock = path.join(root, 'ai-assistant-ui/package-lock.json')
if (fs.existsSync(uiLock)) {
  const lock = JSON.parse(fs.readFileSync(uiLock, 'utf8'))
  if (lock.version && lock.version !== releaseVersion) {
    errors.push(`ai-assistant-ui/package-lock.json version ${lock.version} does not match ${releaseVersion}`)
  }
  if (lock.packages?.['']?.version && lock.packages[''].version !== releaseVersion) {
    errors.push(`ai-assistant-ui/package-lock.json packages[""].version ${lock.packages[''].version} does not match ${releaseVersion}`)
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Version consistency OK: Maven ${mavenVersion}, npm ${releaseVersion}`)

function readMavenProjectVersion(relativePath) {
  const xml = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const projectXml = xml.replace(/<parent>[\s\S]*?<\/parent>/, '')
  const match = projectXml.match(/<artifactId>[^<]+<\/artifactId>\s*<version>([^<]+)<\/version>/)
  if (!match) {
    throw new Error(`Unable to resolve Maven project version from ${relativePath}`)
  }
  return match[1]
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function formatMap(map) {
  return [...map.entries()].map(([file, version]) => `${file}=${version}`).join(', ')
}
