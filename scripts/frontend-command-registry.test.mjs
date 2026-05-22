import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('AiAssistant surfaces duplicate command palette ids in development', async () => {
  const source = await readFile('ai-assistant-ui/src/components/AiAssistant.vue', 'utf8')

  assert.match(source, /duplicatePaletteCommandIds/)
  assert.match(source, /console\.warn/)
  assert.match(source, /Duplicate command palette ids/)
})
