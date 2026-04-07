import { test, expect } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.e2e' });


test('login setup -> upload -> predict -> display (real flow)', async ({ page, request }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('Please set E2E_EMAIL and E2E_PASSWORD before running the test.');
  }

  const loginRes = await request.post('http://localhost:4000/api/v1/auth/login', {
    data: {
      email,
      password,
    },
  });

  expect(loginRes.ok()).toBeTruthy();

  const loginData = await loginRes.json();
  expect(loginData.token).toBeTruthy();

  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('token', token);
    if (user) {
      window.localStorage.setItem('user', JSON.stringify(user));
    }
  }, {
    token: loginData.token,
    user: loginData.user ?? null,
  });

  await page.goto('http://localhost:5173');

  await expect(page.getByText('Upload and review knee X-ray images')).toBeVisible();

  const filePath = path.resolve('fixtures/knee-xray-test.png');
  await page.locator('input[type="file"]').setInputFiles(filePath);

  await page.getByRole('button', { name: /^upload$/i }).click();

  await expect(page.getByText('Running AI analysis...')).toBeVisible({ timeout: 20000 });

  await expect(page.getByText('Prediction Result')).toBeVisible({ timeout: 120000 });
  await expect(page.getByText('Class Probabilities')).toBeVisible({ timeout: 120000 });
  await expect(page.getByText('Grad-CAM Explanation')).toBeVisible({ timeout: 120000 });
});