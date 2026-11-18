import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "test/e2e",
  forbidOnly: Boolean(process.env.CI),
  // The tests share one test server and its fakes, so they run one at a time.
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node test/support/test-server.ts",
    url: `http://localhost:${port}/`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
