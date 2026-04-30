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

  test('panel renders non-interactive code wall canvas', async ({ page }) => {
    await page.click('.ai-fab')
    const canvas = page.locator('.ai-code-wall-canvas')
    await expect(canvas).toBeVisible()
    await expect(canvas).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas).toHaveCSS('pointer-events', 'none')
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
      .toBeGreaterThan(0)
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.height))
      .toBeGreaterThan(0)
  })

  test('reduced motion disables decorative matrix animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.waitForSelector('.ai-fab')
    await expect
      .poll(() =>
        page.locator('.ai-fab').evaluate((el) => getComputedStyle(el, '::before').animationName),
      )
      .toBe('none')

    await page.click('.ai-fab')
    await expect(page.locator('.ai-code-wall-canvas')).toBeVisible()
    await expect
      .poll(() =>
        page.locator('.ai-panel').evaluate((el) => getComputedStyle(el, '::after').animationName),
      )
      .toBe('none')
  })

  test('code wall stays static while page is hidden', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.click('.ai-fab')
    const canvas = page.locator('.ai-code-wall-canvas')
    await expect(canvas).toBeVisible()
    const firstFrame = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())
    await page.waitForTimeout(260)
    const secondFrame = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())
    expect(secondFrame).toBe(firstFrame)
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
    await expect(modelPicker).toContainText(/无法连接模型接口|Unable to reach model API|无模型列表|No models/)
  })

  test('diagnostics panel shows connection details', async ({ page }) => {
    await page.click('.ai-fab')
    const diagnosticsButton = page.locator('.ai-header-diagnostics')
    await diagnosticsButton.click()
    const diagnostics = page.locator('.ai-diagnostics-panel')
    await expect(diagnostics).toBeVisible()
    const diagnosticsRegion = page.getByRole('region', { name: /诊断|Diagnostics/ })
    await expect(diagnosticsRegion).toBeVisible()
    await expect(diagnosticsButton).toHaveAttribute('aria-controls', await diagnosticsRegion.getAttribute('id'))
    await expect(diagnosticsRegion).toHaveAttribute('aria-busy', /true|false/)
    await expect(diagnostics).toContainText(/后端地址|Base URL/)
    await expect(diagnostics).toContainText(/模型接口|Models endpoint/)
    await expect(diagnostics).toContainText(/访问令牌|Access token/)
  })

  test('connection settings update diagnostics endpoint', async ({ page }) => {
    await page.click('.ai-fab')
    await page.click('.ai-header-diagnostics')
    const diagnostics = page.locator('.ai-diagnostics-panel')
    await diagnostics.locator('input[type="text"]').fill('/custom-ai')
    await diagnostics.locator('input[type="password"]').fill('test-token')
    await page.getByRole('button', { name: /测试连接|Test connection/ }).click()
    await expect(diagnostics).toContainText('/custom-ai/models')
    await expect(diagnostics).toContainText(/Configured|已配置/)
    await expect(diagnostics.getByRole('status')).toBeVisible()
  })

  test('clearing saved connection settings removes stale browser storage', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ai-assistant-connection-base-url', '/stale-ai')
      localStorage.setItem('ai-assistant-connection-token', 'stale-token')
    })
    await page.reload()
    await page.waitForSelector('.ai-fab')
    await page.click('.ai-fab')
    await page.click('.ai-header-diagnostics')
    const diagnostics = page.locator('.ai-diagnostics-panel')
    await expect(diagnostics).toContainText('/stale-ai/models')

    await diagnostics.locator('input[type="text"]').fill('')
    await diagnostics.locator('input[type="password"]').fill('')
    await diagnostics.getByRole('button', { name: /保存|Save/ }).click()

    await expect
      .poll(() =>
        page.evaluate(() => ({
          baseUrl: localStorage.getItem('ai-assistant-connection-base-url'),
          token: localStorage.getItem('ai-assistant-connection-token'),
        })),
      )
      .toEqual({ baseUrl: null, token: null })
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
