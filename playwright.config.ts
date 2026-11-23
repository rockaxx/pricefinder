import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3001', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    timeout: 90000,
    env: {
      ADMIN_TOKEN: 'pricefinder-e2e-local-token-only',
      LOCAL_SIMPLE_SEARCH: '0',
    },
  },
})
