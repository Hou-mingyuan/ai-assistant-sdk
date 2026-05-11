/**
 * E2E coverage for the {@link useSendStream} composable extracted from the
 * AiAssistant SFC in round-3 (commit 9fd718f). Existing `assistant.spec.ts`
 * exercises the panel UI but never triggers a send — these tests stub the
 * `/ai-assistant/stream` endpoint so we can verify the user→stream→bubble
 * pipeline without spinning up the backend.
 *
 * We deliberately keep the network stubs *strictly synchronous* (immediate
 * `fulfill` with the full body) because Playwright's `route.fulfill` does not
 * model HTTP chunked transfer-encoding, and `streamChat` then reads the whole
 * body as a single fetch response (the SSE parser handles `\n\n`-delimited
 * events regardless of whether they arrived in one chunk or many).
 */
import { test, expect, type Page } from '@playwright/test'

const STREAM_URL = '**/ai-assistant/stream'

async function openPanelAndType(page: Page, text: string) {
  await page.goto('/')
  await page.waitForSelector('.ai-fab')
  await page.click('.ai-fab')
  const textarea = page.locator('.ai-footer-textarea')
  await textarea.fill(text)
}

test.describe('useSendStream end-to-end', () => {
  test('clicking send creates user + assistant bubbles and toggles loading', async ({ page }) => {
    /* Hold the request open for a beat so we can observe the loading state
     * before the stream is allowed to finish. */
    let release: (() => void) | undefined
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(STREAM_URL, async (route) => {
      await released
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        headers: { 'cache-control': 'no-cache' },
        body: 'data: Hello\n\ndata:  world\n\ndata: [DONE]\n\n',
      })
    })

    await openPanelAndType(page, 'say hi')
    await page.locator('.ai-send').click()

    /* Two bubbles immediately: the user prompt and the empty assistant
     * placeholder (filled by the rAF-coalesced stream loop in useSendStream). */
    const messages = page.locator('.ai-msg')
    await expect(messages).toHaveCount(2)
    await expect(messages.nth(0)).toContainText('say hi')

    release?.()

    /* `Hello` + ` world` are stitched together verbatim by the rAF coalesced
     * flush in `applyStreamToAssistantMessage`. */
    await expect(messages.nth(1)).toContainText(/Hello\s+world/)

    /* The send button becomes interactable again once `loading` flips back to
     * false in the `finally` branch. */
    await expect(page.locator('.ai-send')).toBeEnabled()
  })

  test('aborting an in-flight send drops the empty assistant bubble', async ({ page }) => {
    /* Never resolve the request so `streamChat` is parked on `reader.read()`
     * until the abort signal fires. */
    await page.route(STREAM_URL, async () => {
      await new Promise(() => {
        /* hang forever; release happens when the page aborts the request */
      })
    })

    await openPanelAndType(page, 'will be cancelled')
    await page.locator('.ai-send').click()

    /* Two bubbles while loading; the assistant one is still empty so the
     * MessageList shows the inline stop button next to it. */
    const stopButton = page.locator('.ai-msg-stop')
    await expect(stopButton).toBeVisible()
    await stopButton.click()

    /* `useSendStream.send()` deletes the empty assistant bubble on
     * user-initiated abort, leaving just the user message. */
    await expect(page.locator('.ai-msg')).toHaveCount(1)
    await expect(page.locator('.ai-msg').first()).toContainText('will be cancelled')
    await expect(page.locator('.ai-send')).toBeEnabled()
  })
})
