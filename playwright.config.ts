import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'pnpm exec next dev -p 3001',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'mobile-safari-smoke',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit'
      }
    }
  ]
});
