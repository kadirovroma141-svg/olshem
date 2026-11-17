import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e', testMatch: '**/*.e2e.ts', retries: 1,
  webServer: { command: 'npm run build && npx vite preview --port 4173', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120000 },
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'phone', use: { ...devices['Pixel 5'] } }],
});
