import { test, expect } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.e2e" });

test("login setup -> dashboard -> upload -> predict -> display (real flow)", async ({
  page,
  request,
  baseURL,
}) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Please set E2E_EMAIL and E2E_PASSWORD before running the test.",
    );
  }

  const loginRes = await request.post("http://127.0.0.1:4000/api/v1/auth/login", {
    data: {
      email,
      password,
    },
  });

  expect(loginRes.ok()).toBeTruthy();

  const loginData = await loginRes.json();
  expect(loginData.token).toBeTruthy();

  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem("token", token);
      if (user) {
        window.localStorage.setItem("user", JSON.stringify(user));
      }
    },
    {
      token: loginData.token,
      user: loginData.user ?? null,
    },
  );

  await page.goto(baseURL || "http://localhost:5173");

  // Step 1: dashboard-first landing
  await expect(page.getByText("KneeVision Dashboard")).toBeVisible({
    timeout: 30_000,
  });

  await expect(
    page.getByText("Welcome back. Review your recent activity and start a new analysis."),
  ).toBeVisible();

  // Step 2: go from dashboard to upload page
  await page.getByRole("button", { name: /upload new image/i }).click();

  await expect(
    page.getByText("Upload and review knee X-ray images"),
  ).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText("Gallery")).toBeVisible();

  // Step 3: upload a real image
  const filePath = path.resolve("fixtures/knee-xray-test.png");

  await page.locator('input[type="file"]').setInputFiles(filePath);
  await page.getByRole("button", { name: /^upload$/i }).click();

  // Step 4: wait for inference to start
  await expect(page.getByText("Running AI analysis...")).toBeVisible({
    timeout: 30_000,
  });

  // Step 5: wait for results page
  await expect(page.getByText("Prediction Result")).toBeVisible({
    timeout: 180_000,
  });

  await expect(page.getByText("Class Probabilities")).toBeVisible({
    timeout: 180_000,
  });

  await expect(page.getByText("Grad-CAM Explanation")).toBeVisible({
    timeout: 180_000,
  });
});