#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseMode = process.argv.includes('--release')

const mavenModules = [
  'pom.xml',
  'ai-assistant-server/pom.xml',
  'ai-assistant-observability-support/pom.xml',
  'ai-assistant-service/pom.xml',
  'ai-assistant-client/pom.xml',
  'ai-assistant-demo/pom.xml',
]

const npmPackages = [
  'ai-assistant-ui/package.json',
  'ai-assistant-vue-playground/package.json',
]

const embeddedVersions = [
  ['helm/ai-assistant/Chart.yaml', /appVersion:\s*"([^"]+)"/],
  ['helm/ai-assistant/values.yaml', /\n\s*tag:\s*"([^"]+)"/],
  ['ai-assistant-server/src/main/java/com/aiassistant/mcp/McpServerController.java', /SERVER_VERSION\s*=\s*"([^"]+)"/],
  ['ai-assistant-server/src/main/java/com/aiassistant/config/OpenApiConfiguration.java', /\.version\("([^"]+)"\)/],
  ['ai-assistant-observability-support/src/main/java/com/aiassistant/autoconfigure/AiAssistantOpenApiAutoConfiguration.java', /\.version\("([^"]+)"\)/],
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
const rootPom = fs.readFileSync(path.join(root, 'pom.xml'), 'utf8')
const rootProperty = rootPom.match(/<ai-assistant\.version>([^<]+)<\/ai-assistant\.version>/)?.[1]

if (rootProperty && rootProperty !== mavenVersion) {
  errors.push(`pom.xml ai-assistant.version ${rootProperty} does not match Maven version ${mavenVersion}`)
}

if (releaseMode && mavenVersion?.endsWith('-SNAPSHOT')) {
  errors.push(`Maven release version must not end with -SNAPSHOT: ${mavenVersion}`)
}

for (const [file, version] of npmVersions) {
  if (version !== releaseVersion) {
    errors.push(`${file} version ${version} does not match Maven release version ${releaseVersion}`)
  }
}

for (const packageFile of npmPackages) {
  const lockFile = packageFile.replace(/package\.json$/, 'package-lock.json')
  const lockPath = path.join(root, lockFile)
  if (!fs.existsSync(lockPath)) continue
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  if (lock.version && lock.version !== releaseVersion) {
    errors.push(`${lockFile} version ${lock.version} does not match ${releaseVersion}`)
  }
  if (lock.packages?.['']?.version && lock.packages[''].version !== releaseVersion) {
    errors.push(`${lockFile} packages[""].version ${lock.packages[''].version} does not match ${releaseVersion}`)
  }
}

for (const [file, pattern] of embeddedVersions) {
  const value = fs.readFileSync(path.join(root, file), 'utf8').match(pattern)?.[1]
  if (!value) {
    errors.push(`Unable to read embedded version from ${file}`)
  } else if (value !== releaseVersion) {
    errors.push(`${file} embedded version ${value} does not match ${releaseVersion}`)
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Version consistency OK: Maven/npm/deployment metadata ${releaseVersion}`)

function readMavenProjectVersion(relativePath) {
  const xml = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const parent = xml.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/)?.[1]
  const projectHeader = xml
    .replace(/<parent>[\s\S]*?<\/parent>/, '')
    .split(/<(?:properties|dependencyManagement|dependencies|build|profiles)>/)[0]
  const ownVersion = projectHeader.match(/<version>([^<]+)<\/version>/)?.[1]
  const version = ownVersion || parent
  if (!version) throw new Error(`Unable to resolve Maven project version from ${relativePath}`)
  return version
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function formatMap(map) {
  return [...map.entries()].map(([file, version]) => `${file}=${version}`).join(', ')
}
