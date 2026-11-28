import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const spec = JSON.parse(readFileSync(resolve('docs/api/openapi.json'), 'utf8'))

const expectedPublicOperations = [
  ['post', '/chat'],
  ['post', '/stream'],
  ['post', '/sse'],
  ['get', '/models'],
  ['get', '/runtime/config'],
  ['get', '/url-preview'],
  ['get', '/health'],
  ['get', '/stats'],
  ['get', '/sessions'],
  ['post', '/sessions'],
  ['get', '/sessions/{id}'],
  ['put', '/sessions/{id}'],
  ['delete', '/sessions/{id}'],
  ['post', '/file/summarize'],
  ['post', '/file/translate'],
]

test('OpenAPI snapshot covers remaining public REST operations', () => {
  for (const [method, path] of expectedPublicOperations) {
    assert.ok(spec.paths[path], `missing OpenAPI path ${path}`)
    assert.ok(spec.paths[path][method], `missing ${method.toUpperCase()} ${path}`)
    assert.ok(spec.paths[path][method].responses, `missing responses for ${method.toUpperCase()} ${path}`)
  }
})

test('OpenAPI snapshot describes JSON and multipart request bodies', () => {
  for (const [method, path] of [
    ['post', '/chat'],
    ['post', '/stream'],
    ['post', '/sse'],
    ['post', '/sessions'],
    ['put', '/sessions/{id}'],
  ]) {
    assert.ok(
      spec.paths[path][method].requestBody?.content?.['application/json']?.schema,
      `missing JSON request body schema for ${method.toUpperCase()} ${path}`,
    )
  }

  for (const path of ['/file/summarize', '/file/translate']) {
    assert.ok(
      spec.paths[path].post.requestBody?.content?.['multipart/form-data']?.schema,
      `missing multipart request body schema for POST ${path}`,
    )
  }
})
