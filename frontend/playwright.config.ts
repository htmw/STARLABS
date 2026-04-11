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
    name: 'chromium', // 涵盖了 Chrome 和大部分现代浏览器
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox', // 即使你没装火狐，跑一下 install 就能测
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit', // 即使你没 Mac，也能测 Safari 兼容性！
    use: { ...devices['Desktop Safari'] },
  },
  {
    name: 'edge', // 调用你本地真实的 Edge
    use: { ...devices['Desktop Edge'], channel: 'msedge' },
  },
],
});