import test from 'node:test'
import assert from 'node:assert/strict'

import { countImportant, computeBudget, evaluateBudget, diffPerFile } from './css-budget-check.mjs'

test('countImportant counts !important including the whitespace variant', () => {
  assert.equal(countImportant('a{color:red !important; top:0 ! important}'), 2)
  assert.equal(countImportant('a{color:red}'), 0)
})

test('countImportant ignores !important mentioned inside CSS comments', () => {
  assert.equal(countImportant('/* no !important here */ a{x:1 !important}'), 1)
  assert.equal(countImportant('/* avoid !important and !important */ a{color:red}'), 0)
})

test('computeBudget sums per-file and total', () => {
  const budget = computeBudget([
    { name: 'a.css', text: 'x{c:1 !important}' },
    { name: 'b.css', text: 'y{c:1 !important; d:2 !important}' },
  ])
  assert.equal(budget.total, 3)
  assert.deepEqual(budget.perFile, { 'a.css': 1, 'b.css': 2 })
})

test('evaluateBudget fails when total increases', () => {
  const findings = evaluateBudget({ total: 11, perFile: {} }, { total: 10, perFile: {} })
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['important-increase'],
  )
})

test('evaluateBudget passes when total is equal or lower', () => {
  assert.deepEqual(evaluateBudget({ total: 10, perFile: {} }, { total: 10, perFile: {} }), [])
  assert.deepEqual(evaluateBudget({ total: 9, perFile: {} }, { total: 10, perFile: {} }), [])
})

test('evaluateBudget warns when no baseline exists', () => {
  const findings = evaluateBudget({ total: 5, perFile: {} }, null)
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['no-baseline'],
  )
})

test('diffPerFile reports only changed files', () => {
  const changes = diffPerFile(
    { total: 4, perFile: { 'a.css': 1, 'b.css': 3, 'c.css': 0 } },
    { total: 5, perFile: { 'a.css': 2, 'b.css': 3 } },
  )
  assert.deepEqual(changes, [{ name: 'a.css', before: 2, after: 1 }])
})
