// Browser tests for Plush Titans. The game is static files, so the web server is a plain python http.server.
// Headless Chromium renders Phaser through SwiftShader (2-3 fps in small VMs), hence the long timeouts.
const { defineConfig } = require('@playwright/test');
const PORT = Number(process.env.PT_PORT || 8765); // agents use their own port (CLAUDE.md)
module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 180000,
  expect: { timeout: 30000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: { command: `python3 -m http.server ${PORT}`, url: `http://localhost:${PORT}/index.html`, reuseExistingServer: !process.env.CI, timeout: 30000 },
});
