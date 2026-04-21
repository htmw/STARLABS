import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 240_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox', 
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit', 
    use: { ...devices['Desktop Safari'] },
  },
  {
    name: 'edge', 
    use: { ...devices['Desktop Edge'], channel: 'msedge' },
  },
],
});
