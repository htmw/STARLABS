# Frontend (React + Vite + TypeScript)

## Requirements

- Node.js (LTS recommended)

## Setup & Run

```bash
npm install
npm run dev
```


# E2E Smoke Test Guide

This update adds a real end-to-end smoke test for the core image analysis flow:

**login setup -> upload -> predict -> display**

This test uses:

- local frontend (`Vite`)
- real backend (`Docker`)
- real MongoDB (`Docker`)
- real ML service (`Docker`)

No API responses are mocked.

---

## 1. Install dependencies

Run these commands inside the `frontend` folder:

```bash
npm install -D @playwright/test
npx playwright install chromium
npm install -D @types/node dotenv
```

---

## 2. Required files

Make sure the following files and folders exist inside `frontend`:

```text
frontend/
  fixtures/
    knee-xray-test.png
  tests/
    upload-predict-display.spec.ts
  playwright.config.ts
  .env.e2e
```

---

## 3. Configure `.env.e2e`

Create a file named `.env.e2e` inside `frontend`:

```env
E2E_EMAIL=your_test_email@example.com
E2E_PASSWORD=your_test_password
```

This account must already exist in the system.

---

## 4. Update TypeScript config

In `tsconfig.app.json`, update:

```json
"types": ["vite/client", "node"]
```

and:

```json
"include": ["src", "tests", "playwright.config.ts"]
```

---

## 5. Start required services

From the project root, start Docker services:

```bash
docker compose up -d mongo backend ml-service
```

Then start the frontend locally:

```bash
cd frontend
npm run dev
```

---

## 6. Run the test

From the `frontend` folder:

```bash
npx playwright test tests/upload-predict-display.spec.ts
```

To watch the browser while running:

```bash
npx playwright test tests/upload-predict-display.spec.ts --headed
```

To debug interactively:

```bash
npx playwright test tests/upload-predict-display.spec.ts --debug
```

---

## 7. Expected result

A passing test confirms that the real core flow is working:

- login API succeeds
- image upload succeeds
- prediction request succeeds
- result page displays successfully

Example success output:

```bash
1 passed
```

---

## Notes

- This is a **smoke e2e test** for the main workflow only.
- It is intended to verify that the end-to-end pipeline is functional.
- It does not currently cover registration, logout, error handling, or multiple sample files.
