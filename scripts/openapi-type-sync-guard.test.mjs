import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GENERATED_TYPES_FILE,
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

test('fails when ChatRequest changes without generated frontend types', () => {
  const result = checkOpenApiTypeSync([
    'ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java',
  ])

  assert.equal(result.ok, false)
  assert.deepEqual(result.contractFiles, [
    'ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java',
  ])
})

test('passes when contract and generated frontend types change together', () => {
  const result = checkOpenApiTypeSync([
    'ai-assistant-server/src/main/java/com/aiassistant/model/ChatResponse.java',
    GENERATED_TYPES_FILE,
  ])

  assert.equal(result.ok, true)
  assert.equal(result.generatedTypesChanged, true)
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
