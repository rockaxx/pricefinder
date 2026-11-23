import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'
const port = process.env.PRICEFINDER_E2E_PORT || '3001'
const baseURL = 'http://localhost:' + port
export default defineConfig({
  testDir: './e2e',
  // The first flow compiles multiple routes on a cold Windows dev server.
  timeout: 60000,
  use: { baseURL, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev -- --port ' + port,
    url: baseURL,
    timeout: 90000,
    env: {
      ADMIN_TOKEN: 'pricefinder-e2e-local-token-only',
      LOCAL_SIMPLE_SEARCH: '0',
      ALZA_SEARCH_ENDPOINT: '',
      BAZOS_SEARCH_ENDPOINT: '',
    },
  },
})
