import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeColor, codemodCss } from './css-token-codemod.mjs'

test('normalizeColor lowercases and expands 3-digit hex', () => {
  assert.equal(normalizeColor('#FFF'), '#ffffff')
  assert.equal(normalizeColor('#0F172A'), '#0f172a')
})

test('normalizeColor strips whitespace inside rgba', () => {
  assert.equal(normalizeColor('rgba(15, 23, 42, 0.08)'), 'rgba(15,23,42,0.08)')
})

test('codemodCss maps exact hex and rgba literals to tokens', () => {
  const { out, replaced } = codemodCss(
    'a{color:#fff;background:#0F172A;border:1px solid rgba(15, 23, 42, 0.08)}',
  )
  assert.equal(replaced, 3)
  assert.match(out, /color:var\(--ai-c-white\)/)
  assert.match(out, /background:var\(--ai-c-slate-900\)/)
  assert.match(out, /border:1px solid var\(--ai-c-slate-a08\)/)
})

test('codemodCss leaves unknown colors untouched', () => {
  const { out, replaced } = codemodCss('a{color:#123456;background:rgba(1,2,3,0.5)}')
  assert.equal(replaced, 0)
  assert.equal(out, 'a{color:#123456;background:rgba(1,2,3,0.5)}')
})

test('codemodCss does not corrupt #ffffff when mapping (no #fff overlap)', () => {
  const { out } = codemodCss('a{color:#ffffff}')
  assert.equal(out, 'a{color:var(--ai-c-white)}')
})

test('codemodCss is idempotent', () => {
  const once = codemodCss('a{color:#fff}').out
  const twice = codemodCss(once).out
  assert.equal(once, twice)
})
