import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Helpers
const ensureUploadsDir = async () => {
  await fs.mkdir("uploads", { recursive: true });
};

const sanitizeFilename = (name = "file") => {
  // keep it simple + safe for local filesystem
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120);
};

const isSafeKey = (key) => {
  // prevent path traversal
  return (
    key && !key.includes("..") && !key.includes("/") && !key.includes("\\")
  );
};

// 1) presign (local dev version)
app.post("/api/v1/uploads/presign", async (req, res) => {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) {
      return res
        .status(400)
        .json({ error: "filename and contentType are required" });
    }

    await ensureUploadsDir();

    const safeName = sanitizeFilename(filename);
    const key = `${Date.now()}-${safeName}`;

    // Return relative URLs so Vite proxy works cleanly
    return res.json({
      uploadUrl: `/api/v1/uploads/${encodeURIComponent(key)}`,
      method: "PUT",
      headers: { "Content-Type": contentType },
      fileUrl: `/uploads/${encodeURIComponent(key)}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "presign failed" });
  }
});

// 2) upload raw file bytes to local disk
app.put(
  "/api/v1/uploads/:key",
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req, res) => {
    try {
      const key = decodeURIComponent(req.params.key || "");
      if (!isSafeKey(key)) {
        return res.status(400).json({ error: "invalid key" });
      }

      await ensureUploadsDir();

      const filePath = path.join("uploads", key);
      await fs.writeFile(filePath, req.body);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "upload failed" });
    }
  },
);

// 3) register image metadata (stub until DB schema is ready)
app.post("/api/v1/images", async (req, res) => {
  const { fileUrl, originalName, contentType } = req.body || {};
  if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });

  // TODO: persist this once SCRUM-17 schema is merged
  return res.status(201).json({
    id: String(Date.now()),
    fileUrl,
    originalName: originalName || null,
    contentType: contentType || null,
    createdAt: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
