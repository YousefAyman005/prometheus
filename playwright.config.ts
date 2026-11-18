import { defineConfig } from '@playwright/test'

const URL = 'http://localhost:4173/prometheus/'

// Phone-sized walk-throughs against the production build, using the Chrome already
// installed on this machine. These run locally (`npm run e2e`), not in CI.
// Chrome is not Safari: the real check for iOS behaviour is the app on an iPhone.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  reporter: 'line',
  fullyParallel: true,
  use: {
    baseURL: URL,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Europe/Berlin',
    // The service worker would serve a cached build across runs; offline behaviour is checked on the phone.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: URL,
    reuseExistingServer: true,
  },
})
