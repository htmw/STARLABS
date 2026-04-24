import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = process.env.TEST_API_BASE_URL || "http://localhost:4000";
const MAX_PREDICT_MS = Number(process.env.MAX_PREDICT_MS || 7000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackendHealth(timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`);

      if (res.ok) {
        const data = await safeReadJson(res);
        if (data?.status === "ok") return;
      }
    } catch {
      // ignore and retry
    }

    await sleep(1000);
  }

  throw new Error(`Backend did not become healthy within ${timeoutMs}ms at ${BASE_URL}`);
}

async function safeReadJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

async function getErrorDetail(response) {
  const text = await response.text();
  return text || "<empty response body>";
}

async function getTestImageAsset() {
  const fixturePath = path.resolve(__dirname, "./fixtures/kneevision.png");

  let buffer;
  try {
    buffer = await fs.readFile(fixturePath);
  } catch {
    throw new Error(
      `Real test image not found: ${fixturePath}. Please make sure backend/tests/fixtures/kneevision.png exists.`
    );
  }

  return {
    buffer,
    filename: "kneevision.png",
    contentType: "image/png",
  };
}

async function registerAndLogin() {
  const email = `predict-api-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@test.com`;
  const password = "TestPass123!";

  const registerRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!registerRes.ok) {
    const detail = await getErrorDetail(registerRes);
    throw new Error(`Register failed: ${registerRes.status} ${detail}`);
  }

  expect(registerRes.status).toBe(201);

  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const detail = await getErrorDetail(loginRes);
    throw new Error(`Login failed: ${loginRes.status} ${detail}`);
  }

  expect(loginRes.status).toBe(200);

  const loginData = await safeReadJson(loginRes);
  expect(loginData?.token).toBeTruthy();

  return {
    token: loginData.token,
    email,
    password,
  };
}

async function presignUploadAndRegisterImage(token) {
  const asset = await getTestImageAsset();
  const uniqueFilename = `${Date.now()}-${asset.filename}`;

  const presignRes = await fetch(`${BASE_URL}/api/v1/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: uniqueFilename,
      contentType: asset.contentType,
    }),
  });

  if (!presignRes.ok) {
    const detail = await getErrorDetail(presignRes);
    throw new Error(`Presign failed: ${presignRes.status} ${detail}`);
  }

  expect(presignRes.status).toBe(200);

  const presignData = await safeReadJson(presignRes);

  expect(presignData?.uploadUrl).toBeTruthy();
  expect(presignData?.fileUrl).toBeTruthy();

  const uploadUrl = presignData.uploadUrl.startsWith("http")
    ? presignData.uploadUrl
    : `${BASE_URL}${presignData.uploadUrl}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": asset.contentType,
    },
    body: asset.buffer,
  });

  if (!uploadRes.ok) {
    const detail = await getErrorDetail(uploadRes);
    throw new Error(`Upload failed: ${uploadRes.status} ${detail}`);
  }

  expect(uploadRes.status).toBe(200);

  const registerImageRes = await fetch(`${BASE_URL}/api/v1/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileUrl: presignData.fileUrl,
      originalName: uniqueFilename,
      contentType: asset.contentType,
    }),
  });

  if (!registerImageRes.ok) {
    const detail = await getErrorDetail(registerImageRes);
    throw new Error(`Image registration failed: ${registerImageRes.status} ${detail}`);
  }

  expect(registerImageRes.status).toBe(201);

  const imageData = await safeReadJson(registerImageRes);
  expect(imageData?.fileUrl).toBeTruthy();

  return {
    fileUrl: presignData.fileUrl,
    originalName: uniqueFilename,
  };
}

function validateProbabilities(probabilities) {
  expect(Array.isArray(probabilities)).toBe(true);
  expect(probabilities.length).toBeGreaterThan(0);

  let sum = 0;

  for (const item of probabilities) {
    expect(item).toBeTruthy();
    expect(typeof item).toBe("object");

    expect(typeof item.label).toBe("string");
    expect(item.label.length).toBeGreaterThan(0);

    expect(typeof item.value).toBe("number");
    expect(Number.isFinite(item.value)).toBe(true);
    expect(item.value).toBeGreaterThanOrEqual(0);

    sum += item.value;
  }

  expect(sum).toBeGreaterThanOrEqual(99);
  expect(sum).toBeLessThanOrEqual(101);
}

function validatePredictionPayload(payload) {
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");

  expect(typeof payload.id).toBe("string");
  expect(payload.id.length).toBeGreaterThan(0);

  expect(typeof payload.imageId).toBe("string");
  expect(payload.imageId.length).toBeGreaterThan(0);

  expect(typeof payload.grade).toBe("string");
  expect(payload.grade.length).toBeGreaterThan(0);

  expect(typeof payload.confidence).toBe("number");
  expect(Number.isFinite(payload.confidence)).toBe(true);
  expect(payload.confidence).toBeGreaterThanOrEqual(0);
  expect(payload.confidence).toBeLessThanOrEqual(100);

  expect(typeof payload.severityLabel).toBe("string");
  expect(payload.severityLabel.length).toBeGreaterThan(0);

  validateProbabilities(payload.probabilities);

  expect(typeof payload.summary).toBe("string");
  expect(payload.summary.length).toBeGreaterThan(0);

  expect(typeof payload.heatmapUrl).toBe("string");
  expect(payload.heatmapUrl.startsWith("data:image/png;base64,")).toBe(true);

  expect(Array.isArray(payload.similarCases)).toBe(true);
}

describe("POST /api/v1/predict performance", () => {
  beforeAll(async () => {
    await waitForBackendHealth(30000);
  }, 40000);

  it(
    "should return a valid prediction for a real knee x-ray within 7 seconds",
    async () => {
      const { token } = await registerAndLogin();
      const { fileUrl, originalName } = await presignUploadAndRegisterImage(token);

      const startedAt = performance.now();

      const predictRes = await fetch(`${BASE_URL}/api/v1/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileUrl,
          originalName,
        }),
      });

      const elapsedMs = performance.now() - startedAt;

      if (!predictRes.ok) {
        const detail = await getErrorDetail(predictRes);
        throw new Error(`Predict failed: ${predictRes.status} ${detail}`);
      }

      const predictData = await safeReadJson(predictRes);

      console.log(
        `Prediction API response time: ${elapsedMs.toFixed(2)} ms (limit: ${MAX_PREDICT_MS} ms)`
      );

      expect(predictRes.status).toBe(200);
      validatePredictionPayload(predictData);
      expect(elapsedMs).toBeLessThan(MAX_PREDICT_MS);
    },
    30000
  );
});