import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GENERATED_TYPES_FILE,
  OPENAPI_SPEC_FILE,
  checkOpenApiTypeSync,
} from './openapi-type-sync-guard.mjs'

test('passes when no generated contract files changed', () => {
  const result = checkOpenApiTypeSync([
    'docs/guide/openapi-typescript-codegen.md',
    'ai-assistant-server/src/main/java/com/aiassistant/service/LlmService.java',
  ])

  assert.equal(result.ok, true)
  assert.deepEqual(result.contractFiles, [])
})

test('fails when a covered REST controller changes without OpenAPI snapshot artifacts', () => {
  const result = checkOpenApiTypeSync([
    'ai-assistant-server/src/main/java/com/aiassistant/controller/SessionController.java',
  ])

  assert.equal(result.ok, false)
  assert.deepEqual(result.contractFiles, [
    'ai-assistant-server/src/main/java/com/aiassistant/controller/SessionController.java',
  ])
  assert.deepEqual(result.missingFiles, [OPENAPI_SPEC_FILE, GENERATED_TYPES_FILE])
})

test('passes when contract, OpenAPI snapshot, and generated frontend types change together', () => {
  const result = checkOpenApiTypeSync([
    'ai-assistant-server/src/main/java/com/aiassistant/model/ChatResponse.java',
    OPENAPI_SPEC_FILE,
    GENERATED_TYPES_FILE,
  ])

  assert.equal(result.ok, true)
  assert.equal(result.openapiSpecChanged, true)
  assert.equal(result.generatedTypesChanged, true)
})

test('fails when OpenAPI snapshot changes without regenerated frontend types', () => {
  const result = checkOpenApiTypeSync([OPENAPI_SPEC_FILE])

  assert.equal(result.ok, false)
  assert.deepEqual(result.contractFiles, [])
  assert.deepEqual(result.missingFiles, [GENERATED_TYPES_FILE])
})

test('normalizes Windows path separators', () => {
  const result = checkOpenApiTypeSync([
    'ai-assistant-server\\src\\main\\java\\com\\aiassistant\\controller\\AiAssistantController.java',
  ])

  assert.equal(result.ok, false)
  assert.deepEqual(result.contractFiles, [
    'ai-assistant-server/src/main/java/com/aiassistant/controller/AiAssistantController.java',
  ])
})
