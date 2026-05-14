/**
 * E2E coverage for the K36 `usePromptHistory` integration in
 * `ChatInputArea` + `AiAssistant.send()`. Companion to
 * `useSendStream`'s unit-level spec; this round exercises the full
 * key-handler chain in the real browser, including:
 *
 *  - localStorage persistence under the K36 storage key
 *  - ArrowUp from an empty textarea recalls the most recent prompt,
 *    then walks further back on additional ArrowUp presses
 *  - ArrowDown walks forward; final ArrowDown exits recall and clears
 *  - Escape exits recall and clears the textarea
 *  - K44 bug fix: `historyEnabled` defaults to `true` even when the
 *    host does not pass the prop (the prop-less embed in
 *    `src/main.ts` is exactly that case)
 *
 * We stub the streaming endpoint with immediate, finished responses so
 * each `send()` is fire-and-forget and the textarea is cleared by
 * `record() + sendRaw()` before we test recall.
 */
import { test, expect, type Page } from '@playwright/test';

const STREAM_URL = '**/ai-assistant/stream';
const HISTORY_STORAGE_KEY = 'ai-assistant.prompt-history.v1';

async function stubStream(page: Page, body = 'data: ok\n\ndata: [DONE]\n\n') {
  await page.route(STREAM_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'cache-control': 'no-cache' },
      body,
    });
  });
}

async function openPanel(page: Page, { clearHistory = true }: { clearHistory?: boolean } = {}) {
  await page.goto('/');
  if (clearHistory) {
    /* Wipe the prompt-history LS bucket *after* the first navigation but
     * *before* opening the panel. We can't put this in `addInitScript`:
     * that script runs on every fresh document - including `page.reload()`
     * - which would defeat the persistence test that intentionally
     * reloads to confirm LS-backed recall survives a page refresh. */
    await page.evaluate((key) => window.localStorage.removeItem(key), HISTORY_STORAGE_KEY);
  }
  await page.waitForSelector('.ai-fab');
  await page.click('.ai-fab');
}

async function sendPrompt(page: Page, text: string) {
  const textarea = page.locator('.ai-footer-textarea');
  await textarea.fill(text);
  await page.locator('.ai-send').click();
  /* `useSendStream.send()` clears the textarea synchronously after
   * `record()`. Wait for the assistant bubble to settle so the next
   * `send()` does not race on `loading=true`. */
  await expect(textarea).toHaveValue('');
  await expect(page.locator('.ai-msg-stop')).toHaveCount(0);
}

test.describe('K36 prompt-history recall', () => {
  test.beforeEach(async ({ page }) => {
    /* Each test starts with an empty history bucket. The LS wipe happens
     * inside `openPanel()` *after* navigation - see the comment there for
     * why we can't use `addInitScript` (the persistence test reloads). */
    await stubStream(page);
  });

  test('ArrowUp on an empty textarea recalls the most recent prompt, then walks further back', async ({
    page,
  }) => {
    await openPanel(page);
    await sendPrompt(page, 'first prompt');
    await sendPrompt(page, 'second prompt');
    await sendPrompt(page, 'third prompt');

    const textarea = page.locator('.ai-footer-textarea');
    await textarea.focus();
    await expect(textarea).toHaveValue('');

    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('third prompt');

    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('second prompt');

    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('first prompt');
  });

  test('ArrowDown walks forward and exits recall at the bottom', async ({ page }) => {
    await openPanel(page);
    await sendPrompt(page, 'alpha');
    await sendPrompt(page, 'beta');

    const textarea = page.locator('.ai-footer-textarea');
    await textarea.focus();
    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('beta');
    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('alpha');
    await textarea.press('ArrowDown');
    await expect(textarea).toHaveValue('beta');
    await textarea.press('ArrowDown');
    /* Past the newest entry: useSendStream exits recall mode and clears. */
    await expect(textarea).toHaveValue('');
  });

  test('Escape exits recall and clears the textarea', async ({ page }) => {
    await openPanel(page);
    await sendPrompt(page, 'gamma');

    const textarea = page.locator('.ai-footer-textarea');
    await textarea.focus();
    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('gamma');
    await textarea.press('Escape');
    await expect(textarea).toHaveValue('');
  });

  test('history persists across reload via localStorage', async ({ page }) => {
    await openPanel(page);
    await sendPrompt(page, 'persisted prompt one');
    await sendPrompt(page, 'persisted prompt two');

    /* `usePromptHistory({ storageKey })` writes synchronously after
     * `record()`. Confirm the LS write landed before reload. */
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), HISTORY_STORAGE_KEY))
      .toContain('persisted prompt two');

    await page.reload();
    await page.waitForSelector('.ai-fab');
    await page.click('.ai-fab');
    const textarea = page.locator('.ai-footer-textarea');
    await textarea.focus();
    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('persisted prompt two');
    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('persisted prompt one');
  });

  test('K44 fix: historyEnabled defaults to true when host passes no prop', async ({ page }) => {
    /* The e2e playground in `src/main.ts` mounts the widget without
     * forwarding `historyEnabled`. Before K44, Vue 3's boolean-prop
     * default coerced this to `false` and ArrowUp would do nothing.
     * Recalling at least one entry here is the regression assertion. */
    await openPanel(page);
    await sendPrompt(page, 'recall me please');
    const textarea = page.locator('.ai-footer-textarea');
    await textarea.focus();
    await textarea.press('ArrowUp');
    await expect(textarea).toHaveValue('recall me please');
  });
});
