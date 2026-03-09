import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { preprocessImage } from "./imageProcessor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

// TEMP in-memory store until SCRUM-17 DB schema is ready
const usersByEmail = new Map();

const isValidEmail = (email = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// SCRUM-18: user registration (stub until DB schema is ready)
app.post("/api/v1/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const pwd = String(password || "");

    if (!normalizedEmail || !pwd) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "invalid email format" });
    }

    if (pwd.length < 8) {
      return res
        .status(400)
        .json({ error: "password must be at least 8 characters" });
    }

    if (usersByEmail.has(normalizedEmail)) {
      return res.status(409).json({ error: "email already registered" });
    }

    const passwordHash = await bcrypt.hash(pwd, 10);

    const user = {
      id: String(Date.now()), // TODO: replace with DB id/uuid when SCRUM-17 lands
      email: normalizedEmail,
      passwordHash, // never return this
      createdAt: new Date().toISOString(),
    };

    usersByEmail.set(normalizedEmail, user);

    return res.status(201).json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "registration failed" });
  }
});

// SCRUM-19: user login (stub until DB schema is ready)
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const pwd = String(password || "");

    if (!normalizedEmail || !pwd) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = usersByEmail.get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(pwd, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "dev-secret-change-me",
      { expiresIn: "1h" },
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "login failed" });
  }
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
    const lower = String(filename).toLowerCase();
    const isDicom =
      lower.endsWith(".dcm") ||
      String(contentType).toLowerCase().includes("dicom");
    const baseName = safeName.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    const key = isDicom
      ? `${Date.now()}-${safeName}` // keep .dcm
      : `${Date.now()}-${baseName}.png`; // make all images to png

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
      const contentType = String(
        req.headers["content-type"] || "",
      ).toLowerCase();
      const isDicom =
        contentType.includes("dicom") || key.toLowerCase().endsWith(".dcm");
      const isImage =
        contentType.startsWith("image/") ||
        key.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);

      let buf = req.body;

      // keep aspect ratio, fit inside 1024x1024, output PNG
      if (isImage && !isDicom) {
        buf = await preprocessImage(buf, {
          width: 1024,
          height: 1024,
          format: "png",
        });
      }

      await fs.writeFile(filePath, buf);

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
