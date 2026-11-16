// Run:  cd tests && npm install && npx playwright install chromium && npm test
// (set CHROME_PATH to use an installed Chrome instead of the downloaded Chromium)
const { defineConfig } = require('@playwright/test');
const PORT = process.env.PORT || 8765;
module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1280, height: 860 },
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  },
  webServer: { command: `python3 -m http.server ${PORT} --bind 127.0.0.1`, cwd: '..', port: +PORT, reuseExistingServer: true }
});
