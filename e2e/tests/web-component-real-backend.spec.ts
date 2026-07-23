import { test, expect } from '@playwright/test'

test.describe('Web Component with a real SDK backend', () => {
  test('streams a tenant-scoped zero-key demo response', async ({ page }) => {
    await page.goto('/wc.html')

    const element = page.locator('ai-assistant')
    await expect(element).toHaveAttribute('tenant-id', 'e2e-tenant')
    await expect(element.locator('.ai-fab')).toBeVisible()
    await element.locator('.ai-fab').click()

    const input = element.locator('.ai-footer-textarea')
    await input.fill('Verify the Web Component transport contract')

    const requestPromise = page.waitForRequest(
      (request) => request.url().endsWith('/ai-assistant/stream') && request.method() === 'POST',
    )
    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith('/ai-assistant/stream'),
    )
    await element.getByRole('button', { name: 'Send', exact: true }).click()

    const request = await requestPromise
    const response = await responsePromise
    expect(request.headers()['x-tenant-id']).toBe('e2e-tenant')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/event-stream')
    await expect(
      element.getByText('[DEMO MODE - deterministic local response, not real AI]', { exact: true }),
    ).toBeVisible()
    await expect(element).toContainText('Verify the Web Component transport contract')
  })
})
