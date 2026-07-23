import { defineConfig } from '@playwright/test'

const backendOrigin =
  process.env.AI_ASSISTANT_E2E_BACKEND_ORIGIN || 'http://127.0.0.1:8080'

export default defineConfig({
  testDir: './tests',
  // Limit concurrent cold Vite transforms so component bundles are ready within UI waits.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: process.env.CI ? 1 : 3,
  retries: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5273',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  /**
   * Use a dedicated 5273 port (not Vite's default 5173) so the e2e suite is
   * isolated from any other Vite instance the developer might be running,
   * and pin both sides to the IPv4 loopback (`127.0.0.1`) so we don't get
   * burned by Node/Playwright's mixed IPv4/IPv6 `localhost` resolution on
   * Windows - on this dev box `localhost` resolves to `::1` first, but the
   * Windows firewall blocks `[::1]` loopback traffic, so anything routed
   * through the v6 loopback deadlocks Playwright's readiness probe.
   *
   * `strictPort` makes Vite fail fast if 5273 is somehow taken, rather
   * than silently sliding to 5274 and leaving Playwright probing a port
   * that no one ever bound.
   */
  webServer: [
    {
      command: 'node start-real-backend.mjs',
      cwd: '.',
      url: `${backendOrigin}/actuator/health/readiness`,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5273 --strictPort',
      cwd: '.',
      url: 'http://127.0.0.1:5273/',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
