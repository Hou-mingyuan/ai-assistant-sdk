import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  /**
   * `--host 127.0.0.1` and the `localhost`-based `baseURL` disagreed on
   * Windows (Playwright probed `localhost:5173` while Vite bound only to
   * `127.0.0.1`, so the readiness check timed out). Letting Vite use its
   * default `localhost` bind keeps the auto-start path green on both Windows
   * and CI Linux runners.
   */
  webServer: {
    command: 'npm run dev',
    cwd: '.',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
