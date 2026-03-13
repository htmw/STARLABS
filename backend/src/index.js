import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { preprocessImage } from "./imageProcessor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectToMongo, getDb } from "./db.js";

dotenv.config();

const isValidEmail = (email = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Authorization token is required." });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret-change-me",
    );

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// SCRUM-18: user registration
app.post("/api/v1/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const pwd = String(password || "");

    if (!normalizedEmail || !pwd) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    if (pwd.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
    }

    const db = getDb();
    const users = db.collection("users");

    const existingUser = await users.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    const passwordHash = await bcrypt.hash(pwd, 10);
    const now = new Date().toISOString();

    const user = {
      email: normalizedEmail,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(user);
    const userId = result.insertedId.toString();

    await users.updateOne({ _id: result.insertedId }, { $set: { userId } });

    return res.status(201).json({
      id: userId,
      userId,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);

    if (err?.code === 11000) {
      return res.status(409).json({ message: "User already exists." });
    }

    return res.status(500).json({ message: "Registration failed." });
  }
});

// SCRUM-19: user login
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const pwd = String(password || "");

    if (!normalizedEmail || !pwd) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const db = getDb();
    const users = db.collection("users");

    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(pwd, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user.userId || user._id.toString(), email: user.email },
      process.env.JWT_SECRET || "dev-secret-change-me",
      { expiresIn: "1h" },
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        userId: user.userId || user._id.toString(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed." });
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

// SCRUM-20: register image metadata
app.post("/api/v1/images", requireAuth, async (req, res) => {
  try {
    const { fileUrl, originalName, contentType } = req.body || {};

    if (!fileUrl) {
      return res.status(400).json({ message: "fileUrl is required" });
    }

    const db = getDb();
    const images = db.collection("images");

    const now = new Date().toISOString();

    const imageDoc = {
      fileUrl,
      originalName: originalName || null,
      contentType: contentType || null,
      uploadedBy: {
        userId: req.user.userId,
        email: req.user.email,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await images.insertOne(imageDoc);

    return res.status(201).json({
      id: result.insertedId.toString(),
      fileUrl: imageDoc.fileUrl,
      originalName: imageDoc.originalName,
      contentType: imageDoc.contentType,
      uploadedBy: imageDoc.uploadedBy,
      createdAt: imageDoc.createdAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Image registration failed." });
  }
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectToMongo();
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
