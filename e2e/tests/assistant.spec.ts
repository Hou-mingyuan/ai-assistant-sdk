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

  test('mobile panel fits the visible viewport and locks background scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.click('.ai-fab')

    await expect(page.locator('html')).toHaveClass(/ai-assistant-mobile-scroll-locked/)
    await expect(page.locator('body')).toHaveClass(/ai-assistant-mobile-scroll-locked/)
    const geometry = await page.locator('.ai-panel').evaluate((panel) => {
      const rect = panel.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
      }
    })
    expect(geometry.left).toBe(0)
    expect(geometry.top).toBe(0)
    expect(Math.abs(geometry.right - geometry.viewportWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.bottom - geometry.viewportHeight)).toBeLessThanOrEqual(1)

    const touchTargets = await page.locator('.ai-panel').evaluate((panel) => {
      const selectors = [
        '.ai-header-actions button',
        '.ai-quick-toggle',
        '.ai-mode-segment',
        '.ai-model-picker-trigger',
        '.ai-page-context-badge',
        '.ai-attach-image',
        '.ai-mic',
        '.ai-voice-loop',
        '.ai-tools-toggle',
        '.ai-send',
      ]
      return Array.from(panel.querySelectorAll<HTMLButtonElement>(selectors.join(',')))
        .filter((button) => button.getBoundingClientRect().width > 0)
        .map((button) => ({
          className: button.className,
          height: button.getBoundingClientRect().height,
        }))
    })
    expect(touchTargets.length).toBeGreaterThan(0)
    expect(touchTargets.filter((target) => target.height < 32)).toEqual([])

    await page.click('.ai-close')
    await expect(page.locator('html')).not.toHaveClass(/ai-assistant-mobile-scroll-locked/)
    await expect(page.locator('body')).not.toHaveClass(/ai-assistant-mobile-scroll-locked/)

    await page.setViewportSize({ width: 768, height: 1024 })
    await expect
      .poll(async () => (await page.locator('.ai-fab').boundingBox())?.x ?? 0)
      .toBeGreaterThan(680)
  })

  test('panel keeps the retired code wall non-interactive', async ({ page }) => {
    await page.click('.ai-fab')
    const canvas = page.locator('.ai-code-wall-canvas')
    await expect(canvas).toBeAttached()
    await expect(canvas).toBeHidden()
    await expect(canvas).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas).toHaveCSS('pointer-events', 'none')
    const textarea = page.locator('.ai-footer-textarea')
    await textarea.fill('The hidden decoration must not intercept input')
    await expect(textarea).toHaveValue('The hidden decoration must not intercept input')
  })

  test('reduced motion disables decorative shell animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.waitForSelector('.ai-fab')
    await expect
      .poll(() =>
        page.locator('.ai-fab').evaluate((el) => getComputedStyle(el, '::before').animationName),
      )
      .toBe('none')

    await page.click('.ai-fab')
    await expect(page.locator('.ai-code-wall-canvas')).toBeHidden()
    await expect
      .poll(() =>
        page.locator('.ai-panel').evaluate((el) => getComputedStyle(el, '::after').animationName),
      )
      .toBe('none')
  })

  test('hidden page keeps retired code wall inert', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.click('.ai-fab')
    const canvas = page.locator('.ai-code-wall-canvas')
    await expect(canvas).toBeAttached()
    await expect(canvas).toBeHidden()
    await expect(canvas).toHaveCSS('pointer-events', 'none')
    await expect(page.locator('.ai-footer-textarea')).toBeEditable()
  })

  test('panel has mode buttons', async ({ page }) => {
    await page.click('.ai-fab')
    const modeBar = page.locator('.ai-mode-segmented')
    await expect(modeBar).toBeVisible()
    const buttons = modeBar.locator('.ai-mode-segment')
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
    await page.route('**/ai-assistant/models**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Model service unavailable' }),
      })
    })
    await page.reload()
    await page.waitForSelector('.ai-fab')
    await page.click('.ai-fab')
    const modelPicker = page.locator('.ai-model-select')
    await expect(modelPicker).toBeVisible()
    await expect(modelPicker).toBeDisabled()
    await expect(modelPicker).toContainText(
      /无法连接模型接口|模型接口返回服务端错误|Unable to reach model API|Model API returned a server error|无模型列表|No models/,
    )
  })

  test('diagnostics panel shows connection details', async ({ page }) => {
    await page.click('.ai-fab')
    await page.click('.ai-header-settings')
    await page.getByRole('menuitem', { name: /诊断|Diagnostics/ }).click()
    const diagnostics = page.locator('.ai-diagnostics-dialog')
    await expect(diagnostics).toBeVisible()
    const diagnosticsDialog = page.getByRole('dialog', { name: /诊断|Diagnostics/ })
    await expect(diagnosticsDialog).toBeVisible()
    await expect(diagnosticsDialog).toHaveAttribute('aria-busy', /true|false/)
    await expect(diagnostics).toContainText(/后端地址|Base URL/)
    await expect(diagnostics).toContainText(/模型接口|Models endpoint/)
    await expect(diagnostics).toContainText(/访问令牌|Access token/)
    await expect(diagnostics).toContainText(/最近错误|Last error/)
  })

  test('settings menu closes with Escape', async ({ page }) => {
    await page.click('.ai-fab')
    const settingsButton = page.locator('.ai-header-settings')
    await settingsButton.click()
    const settingsMenu = page.locator('.ai-header-settings-menu')
    await expect(settingsMenu).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(settingsMenu).not.toBeVisible()
    await expect(settingsButton).toBeFocused()
  })

  test('settings menu supports keyboard navigation', async ({ page }) => {
    await page.click('.ai-fab')
    const settingsButton = page.locator('.ai-header-settings')
    await settingsButton.focus()
    await page.keyboard.press('Enter')

    const menuItems = page.locator('.ai-header-settings-menu [role="menuitem"]')
    await expect(menuItems.first()).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(menuItems.nth(1)).toBeFocused()

    await page.keyboard.press('ArrowUp')
    await expect(menuItems.first()).toBeFocused()
  })

  test('footer presents command dock and status rail', async ({ page }) => {
    await page.click('.ai-fab')
    const inputRow = page.locator('.ai-footer-input-row')
    const sendGroup = page.locator('.ai-footer-send-group')
    const statusRow = page.locator('.ai-footer-model-row')

    await expect(inputRow).toBeVisible()
    await expect(sendGroup).toBeVisible()
    await expect(statusRow).toBeVisible()

    await expect(inputRow).toHaveCSS('border-radius', '16px')
    await expect(sendGroup).toHaveCSS('display', 'flex')
    await expect(statusRow).toHaveCSS('display', 'grid')
  })

  test('model picker clears quick tools and stays inside the panel', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.reload()
      await page.waitForSelector('.ai-fab')
      await page.click('.ai-fab')

      const trigger = page.locator('.ai-model-picker-trigger')
      await expect(trigger).toBeEnabled()
      await trigger.click()
      await expect(page.locator('.ai-model-menu')).toBeVisible()

      const geometry = await page.locator('.ai-panel').evaluate((panel) => {
        const rect = (element: Element) => {
          const bounds = element.getBoundingClientRect()
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
          }
        }
        const childRect = (selector: string) => {
          const element = panel.querySelector(selector)
          if (!element) throw new Error(`Missing ${selector}`)
          return rect(element)
        }
        return {
          panel: rect(panel),
          menu: childRect('.ai-model-menu'),
          quickTools: childRect('.ai-footer-quick-toggles'),
        }
      })

      expect(geometry.menu.bottom).toBeLessThanOrEqual(geometry.quickTools.top - 3)
      expect(geometry.menu.left).toBeGreaterThanOrEqual(geometry.panel.left - 1)
      expect(geometry.menu.right).toBeLessThanOrEqual(geometry.panel.right + 1)

      await trigger.click()
      await page.click('.ai-close')
    }
  })

  test('connection settings update diagnostics endpoint', async ({ page }) => {
    await page.route('**/custom-ai/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          provider: 'demo',
          model: 'demo-local',
          models: ['demo-local'],
          status: 'running',
        }),
      })
    })
    await page.click('.ai-fab')
    await page.click('.ai-header-settings')
    await page.getByRole('menuitem', { name: /诊断|Diagnostics/ }).click()
    const diagnostics = page.locator('.ai-diagnostics-dialog')
    await diagnostics.locator('input[type="text"]').fill('/custom-ai')
    await diagnostics.locator('input[type="password"]').fill('test-token')
    await page.getByRole('button', { name: /测试连接|Test connection/ }).click()
    await expect(diagnostics).toContainText('/custom-ai/models')
    await expect(diagnostics).toContainText(/Configured|已配置/)
    await expect(diagnostics.locator('.ai-connection-config-message')).toBeVisible()
  })

  test('diagnostics copy includes troubleshooting details', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            ;(window as unknown as { __copiedDiagnostics?: string }).__copiedDiagnostics = text
          },
        },
      })
    })
    await page.click('.ai-fab')
    await page.click('.ai-header-settings')
    await page.getByRole('menuitem', { name: /诊断|Diagnostics/ }).click()
    const diagnostics = page.locator('.ai-diagnostics-dialog')
    await diagnostics.getByRole('button', { name: /复制|Copy/ }).click()
    await expect(diagnostics.getByRole('button', { name: /已复制|Copied/ })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __copiedDiagnostics?: string }).__copiedDiagnostics || ''),
      )
      .toContain('AI Assistant Diagnostics')
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __copiedDiagnostics?: string }).__copiedDiagnostics || ''),
      )
      .toContain('Last error:')
  })

  test('clearing saved connection settings removes stale browser storage', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ai-assistant-connection-base-url', '/stale-ai')
      localStorage.setItem('ai-assistant-connection-token', 'stale-token')
    })
    await page.reload()
    await page.waitForSelector('.ai-fab')
    await page.click('.ai-fab')
    await page.click('.ai-header-settings')
    await page.getByRole('menuitem', { name: /诊断|Diagnostics/ }).click()
    const diagnostics = page.locator('.ai-diagnostics-dialog')
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
    const buttons = page.locator('.ai-mode-segment')
    await buttons.nth(1).click()
    await expect(buttons.nth(1)).toHaveClass(/active/)
  })

  test('expand button toggles fullscreen', async ({ page }) => {
    await page.click('.ai-fab')
    await page.getByRole('button', { name: /全屏|Fullscreen/ }).click()
    const wrapper = page.locator('.ai-assistant-wrapper')
    await expect(wrapper).toHaveClass(/panel-expanded/)
    await page.getByRole('button', { name: /退出全屏|Exit fullscreen/ }).click()
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
