import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const spec = JSON.parse(readFileSync(resolve('docs/api/openapi.json'), 'utf8'))

const expectedAdminOperations = [
  ['get', '/admin/overview'],
  ['get', '/admin/tokens'],
  ['post', '/admin/tokens/quota'],
  ['get', '/admin/prompts'],
  ['post', '/admin/prompts'],
  ['get', '/admin/tools'],
  ['post', '/admin/rag/ingest'],
  ['get', '/admin/rag/stats'],
  ['post', '/admin/ab-test'],
  ['get', '/admin/ab-test'],
  ['post', '/admin/fallback-chain'],
  ['get', '/admin/fallback-chain'],
  ['get', '/admin/plugins'],
  ['post', '/admin/plugins/{pluginId}/unload'],
  ['get', '/admin/system'],
]

test('OpenAPI snapshot covers adminApi public operations', () => {
  for (const [method, path] of expectedAdminOperations) {
    assert.ok(spec.paths[path], `missing OpenAPI path ${path}`)
    assert.ok(spec.paths[path][method], `missing ${method.toUpperCase()} ${path}`)
    assert.ok(
      spec.paths[path][method].responses?.['200']?.content?.['application/json']?.schema,
      `missing JSON 200 response schema for ${method.toUpperCase()} ${path}`,
    )
  }
})

test('OpenAPI snapshot covers adminApi JSON request bodies', () => {
  for (const [method, path] of [
    ['post', '/admin/tokens/quota'],
    ['post', '/admin/prompts'],
    ['post', '/admin/rag/ingest'],
    ['post', '/admin/ab-test'],
    ['post', '/admin/fallback-chain'],
  ]) {
    assert.ok(
      spec.paths[path][method].requestBody?.content?.['application/json']?.schema,
      `missing JSON request body schema for ${method.toUpperCase()} ${path}`,
    )
  }
})
