import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    cwd: '../ai-assistant-vue-playground',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
