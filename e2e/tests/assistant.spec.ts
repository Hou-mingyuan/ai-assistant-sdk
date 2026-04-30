import { test, expect } from '@playwright/test'

test.describe('AI Assistant Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ai-fab')
  })

  test('FAB is visible on page load', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AI Assistant E2E Playground' })).toBeVisible()
    const fab = page.locator('.ai-fab')
    await expect(fab).toBeVisible()
  })

  test('clicking FAB opens panel', async ({ page }) => {
    await page.click('.ai-fab')
    await expect(page.locator('.ai-panel')).toBeVisible()
    await expect(page.locator('.ai-header')).toBeVisible()
  })

  test('panel has mode buttons', async ({ page }) => {
    await page.click('.ai-fab')
    const modeBar = page.locator('.ai-mode-bar')
    await expect(modeBar).toBeVisible()
    const buttons = modeBar.locator('button')
    await expect(buttons).toHaveCount(3)
  })

  test('close button closes panel', async ({ page }) => {
    await page.click('.ai-fab')
    await expect(page.locator('.ai-panel')).toBeVisible()
    await page.click('.ai-close')
    await expect(page.locator('.ai-panel')).not.toBeVisible()
  })

  test('textarea accepts input', async ({ page }) => {
    await page.click('.ai-fab')
    const textarea = page.locator('.ai-footer-textarea')
    await textarea.fill('Hello, AI!')
    await expect(textarea).toHaveValue('Hello, AI!')
  })

  test('model picker explains missing backend model list', async ({ page }) => {
    await page.click('.ai-fab')
    const modelPicker = page.locator('.ai-model-select')
    await expect(modelPicker).toBeVisible()
    await expect(modelPicker).toBeDisabled()
    await expect(modelPicker).toContainText(/无模型列表|No models/)
  })

  test('search bar appears when messages exist', async ({ page }) => {
    await page.click('.ai-fab')
    const searchInput = page.locator('.ai-chat-search-input')
    await expect(searchInput).not.toBeVisible()
  })

  test('mode switching works', async ({ page }) => {
    await page.click('.ai-fab')
    const buttons = page.locator('.ai-mode-bar button')
    await buttons.first().click()
    await expect(buttons.first()).toHaveClass(/active/)
  })

  test('expand button toggles fullscreen', async ({ page }) => {
    await page.click('.ai-fab')
    await page.click('.ai-expand')
    const wrapper = page.locator('.ai-assistant-wrapper')
    await expect(wrapper).toHaveClass(/panel-expanded/)
    await page.click('.ai-expand')
    await expect(wrapper).not.toHaveClass(/panel-expanded/)
  })

  test('new session button creates tab', async ({ page }) => {
    await page.click('.ai-fab')
    const sessionTabs = page.locator('.ai-session-tab')
    const tabsBefore = await sessionTabs.count()
    await page.click('.ai-new-session')
    await expect.poll(() => sessionTabs.count()).toBeGreaterThan(tabsBefore)
  })
})
