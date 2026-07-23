import { test, expect, type Page } from '@playwright/test'

async function openPersonalizeDialog(page: Page) {
  await page.goto('/')
  await page.waitForSelector('.ai-fab')
  await page.click('.ai-fab')
  await page.click('.ai-header-settings')
  await page.getByRole('menuitem', { name: /个性化|Personalize/ }).click()
  await expect(page.getByRole('dialog', { name: /个性化|Personalize/ })).toBeVisible()
}

test.describe('runtime provider configuration', () => {
  test('detects provider models and refreshes model picker from personalization', async ({ page }) => {
    const adminToken = 'e2e-runtime-provider-admin-token'
    await page.addInitScript((token) => {
      ;(
        window as typeof window & { __AI_ASSISTANT_E2E_ADMIN_TOKEN__?: string }
      ).__AI_ASSISTANT_E2E_ADMIN_TOKEN__ = token
    }, adminToken)

    await page.route('**/ai-assistant/admin/runtime/model-config', async (route) => {
      expect(route.request().headers()['x-admin-token']).toBe(adminToken)
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            provider: 'minimax',
            baseUrl: 'https://api.minimaxi.com/v1',
            model: '',
            allowedModels: [],
            apiKeyConfigured: false,
          }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          provider: 'minimax',
          baseUrl: 'https://api.minimaxi.com/v1',
          model: 'MiniMax-M2.5',
          allowedModels: ['MiniMax-M2.5', 'MiniMax-M2.7'],
          apiKeyConfigured: true,
        }),
      })
    })
    await page.route('**/ai-assistant/admin/runtime/model-config/discover-models', async (route) => {
      expect(route.request().headers()['x-admin-token']).toBe(adminToken)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, models: ['MiniMax-M2.5', 'MiniMax-M2.7'] }),
      })
    })
    await page.route('**/ai-assistant/models?probe=true', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          models: ['MiniMax-M2.5', 'MiniMax-M2.7'],
          defaultModel: 'MiniMax-M2.5',
        }),
      })
    })

    await openPersonalizeDialog(page)
    const modelProviderSection = page.locator('.ai-personalize-model-section').first()
    await expect(modelProviderSection.getByPlaceholder('minimax / openai / deepseek')).toHaveValue(
      'minimax',
    )
    await expect(modelProviderSection.getByLabel(/模型 API Base URL|Model API Base URL/)).toHaveValue(
      'https://api.minimaxi.com/v1',
    )
    await page.getByRole('button', { name: 'MiniMax' }).click()
    await modelProviderSection.getByLabel(/模型 API Key|Model API key/).fill('runtime-key')
    const detectModels = modelProviderSection.getByRole('button', { name: /检测模型|Detect models/ })
    await expect(detectModels).toBeEnabled()
    await detectModels.click()
    await expect(modelProviderSection.getByLabel(/允许模型列表|Allowed models/)).toHaveValue(
      'MiniMax-M2.5, MiniMax-M2.7',
    )

    await modelProviderSection
      .getByRole('button', { name: /保存模型配置并刷新列表|Save model config/ })
      .click()
    await expect(page.locator('.ai-model-select')).toContainText('MiniMax-M2.5')
  })
})
