import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const spec = JSON.parse(readFileSync(resolve('docs/api/openapi.json'), 'utf8'))

const expectedPublicOperations = [
  ['get', '/health'],
  ['get', '/stats'],
  ['get', '/templates'],
  ['post', '/templates'],
  ['post', '/templates/{name}/render'],
  ['get', '/sessions'],
  ['post', '/sessions'],
  ['get', '/sessions/{id}'],
  ['put', '/sessions/{id}'],
  ['delete', '/sessions/{id}'],
  ['post', '/file/summarize'],
  ['post', '/file/translate'],
  ['post', '/batch'],
  ['get', '/capabilities'],
  ['post', '/capabilities/{name}/invoke'],
  ['post', '/async/chat'],
  ['get', '/async/{taskId}'],
  ['post', '/export'],
  ['get', '/health/connectors'],
  ['get', '/health/provider'],
  ['post', '/health/provider/recheck'],
  ['post', '/connectors/register'],
  ['delete', '/connectors/{connectorId}'],
  ['post', '/mcp'],
  ['post', '/admin/runtime/model-config/discover-models'],
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
    ['post', '/templates'],
    ['post', '/templates/{name}/render'],
    ['post', '/sessions'],
    ['put', '/sessions/{id}'],
    ['post', '/batch'],
    ['post', '/capabilities/{name}/invoke'],
    ['post', '/async/chat'],
    ['post', '/connectors/register'],
    ['post', '/mcp'],
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
