import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { preprocessImage } from "./imageProcessor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectToMongo, getDb } from "./db.js";
import { ObjectId } from "mongodb";

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
// app.use(express.json());
app.use(express.json({ limit: "20mb" }));

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

// const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_SERVICE_URL = process.env.ML_SERVICE_URL;
const uploadedImageDataByKey = new Map();

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";

  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildPredictionsCsv(docs) {
  const headers = [
    "predictionId",
    "imageId",
    "fileUrl",
    "grade",
    "confidence",
    "severityLabel",
    "summary",
    "createdAt",
  ];

  const rows = docs.map((doc) => [
    doc._id?.toString() || "",
    doc.imageId || "",
    doc.fileUrl || "",
    doc.result?.grade || "",
    doc.result?.confidence ?? "",
    doc.result?.severityLabel || "",
    doc.result?.summary || "",
    doc.createdAt || "",
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");
}

async function callMlPredict(localFilePath, originalName = "image.png") {
  const fileBuffer = await fs.readFile(localFilePath);

  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: "image/png" });

  form.append("file", blob, originalName);

  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ML service request failed (${response.status}): ${errorText}`,
    );
  }

  return response.json();
}

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

      if (isImage && !isDicom) {
        uploadedImageDataByKey.set(key, {
          imageData: `data:image/png;base64,${buf.toString("base64")}`,
          contentType: "image/png",
        });
      }

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

    const filename = path.basename(decodeURIComponent(fileUrl));
    const uploadedImageData = uploadedImageDataByKey.get(filename);

    const imageDoc = {
      fileUrl,
      originalName: originalName || null,
      contentType: contentType || null,
      imageData: uploadedImageData?.imageData || null,
      uploadedBy: {
        userId: req.user.userId,
        email: req.user.email,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await images.insertOne(imageDoc);

    uploadedImageDataByKey.delete(filename);

    return res.status(201).json({
      id: result.insertedId.toString(),
      fileUrl: imageDoc.fileUrl,
      originalName: imageDoc.originalName,
      contentType: imageDoc.contentType,
      imageData: imageDoc.imageData,
      uploadedBy: imageDoc.uploadedBy,
      createdAt: imageDoc.createdAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Image registration failed." });
  }
});

// SCRUM-46: call AI inference service for a saved image
// app.post("/api/v1/predict", requireAuth, async (req, res) => {
//   try {
//     const { fileUrl, originalName } = req.body || {};

//     if (!fileUrl) {
//       return res.status(400).json({ message: "fileUrl is required." });
//     }

//     if (
//       typeof fileUrl !== "string" ||
//       !fileUrl.startsWith("/uploads/")
//     ) {
//       return res.status(400).json({ message: "Invalid fileUrl." });
//     }

//     const decodedFileUrl = decodeURIComponent(fileUrl);
//     const filename = path.basename(decodedFileUrl);
//     const localFilePath = path.join("uploads", filename);

//     try {
//       await fs.access(localFilePath);
//     } catch {
//       return res.status(404).json({ message: "Uploaded file not found." });
//     }

//     const prediction = await callMlPredict(
//       localFilePath,
//       originalName || filename,
//     );

//     return res.status(200).json(prediction);
//   } catch (err) {
//     console.error("Prediction failed:", err);
//     return res.status(500).json({ message: "Prediction failed." });
//   }
// });

app.post("/api/v1/predict", requireAuth, async (req, res) => {
  try {
    const { fileUrl, originalName } = req.body || {};

    if (!fileUrl) {
      return res.status(400).json({ message: "fileUrl is required." });
    }

    if (typeof fileUrl !== "string" || !fileUrl.startsWith("/uploads/")) {
      return res.status(400).json({ message: "Invalid fileUrl." });
    }

    const decodedFileUrl = decodeURIComponent(fileUrl);
    const filename = path.basename(decodedFileUrl);
    const localFilePath = path.join("uploads", filename);

    try {
      await fs.access(localFilePath);
    } catch {
      return res.status(404).json({ message: "Uploaded file not found." });
    }

    const prediction = await callMlPredict(
      localFilePath,
      originalName || filename,
    );

    const db = getDb();
    const imagesCollection = db.collection("images");
    const predictionsCollection = db.collection("predictions");

    const imageDoc = await imagesCollection.findOne({
      fileUrl,
      "uploadedBy.userId": req.user.userId,
    });

    if (!imageDoc) {
      return res.status(404).json({ message: "Image not found." });
    }

    const existing = await predictionsCollection.findOne({
      imageId: imageDoc._id.toString(),
      userId: req.user.userId,
    });

    if (existing) {
      return res.status(200).json({
        id: existing._id.toString(),
        imageId: existing.imageId,
        ...existing.result,
      });
    }

    const predictionDoc = {
      userId: req.user.userId,
      imageId: imageDoc._id.toString(),
      fileUrl: imageDoc.fileUrl,

      result: prediction, // full ML output

      createdAt: new Date().toISOString(),
    };

    const saved = await predictionsCollection.insertOne(predictionDoc);

    return res.status(200).json({
      id: saved.insertedId.toString(),
      imageId: predictionDoc.imageId,
      ...prediction,
    });
  } catch (err) {
    console.error("Prediction failed:", err);
    return res.status(500).json({ message: "Prediction failed." });
  }
});

const PORT = process.env.PORT || 4000;

// ─── Chat history endpoints ───────────────────────────────────────────────────
// Save chat history for a specific prediction
app.post("/api/v1/chat-history", requireAuth, async (req, res) => {
  try {
    const { predictionId, messages } = req.body || {};

    if (!predictionId || !messages) {
      return res
        .status(400)
        .json({ message: "predictionId and messages are required." });
    }

    const db = getDb();
    const chatHistories = db.collection("chatHistories");

    await chatHistories.updateOne(
      { predictionId, userId: req.user.userId },
      {
        $set: {
          predictionId,
          userId: req.user.userId,
          messages,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: { createdAt: new Date().toISOString() },
      },
      { upsert: true },
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Save chat history failed:", err);
    return res.status(500).json({ message: "Failed to save chat history." });
  }
});

// Get chat history for a specific prediction
app.get("/api/v1/chat-history/:predictionId", requireAuth, async (req, res) => {
  try {
    const { predictionId } = req.params;

    const db = getDb();
    const chatHistories = db.collection("chatHistories");

    const history = await chatHistories.findOne({
      predictionId,
      userId: req.user.userId,
    });

    return res.status(200).json({ messages: history?.messages ?? [] });
  } catch (err) {
    console.error("Get chat history failed:", err);
    return res.status(500).json({ message: "Failed to get chat history." });
  }
});
// ─── End Chat history endpoints ───────────────────────────────────────────────

// ─── Chat endpoint ────────────────────────────────────────────────────────────
// Receives the uploaded image (base64), ML result metadata, similar cases,
// and full conversation history. Builds a system prompt with all the clinical
// context and sends it to Llama 4 via Groq (free, vision-capable).
app.post("/api/v1/chat", requireAuth, async (req, res) => {
  try {
    const { imageBase64, result, similarCases, messages } = req.body || {};

    if (!imageBase64 || !result || !messages) {
      return res
        .status(400)
        .json({ message: "imageBase64, result, and messages are required." });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ message: "Groq API key not configured." });
    }

    const similarSummary = (similarCases || [])
      .map(
        (c, i) => `
Case ${i + 1} (KL Grade ${c.klGrade}, ${(c.similarity * 100).toFixed(1)}% match):
- Osteophytes: ${c.osteophyteSeverity}
- Joint space narrowing: ${c.jointSpaceNarrowing}
- Subchondral sclerosis: ${c.subchondralSclerosis}
- Bone texture: ${c.boneTexture}
- Affected compartment: ${c.affectedCompartment}
- Findings: ${c.overallFindings}`,
      )
      .join("\n");

    const systemPrompt = `You are a radiology assistant specializing in knee osteoarthritis analysis using the Kellgren-Lawrence (KL) grading system.

UPLOADED IMAGE ANALYSIS:
- Predicted KL Grade: ${result.grade}
- Severity: ${result.severityLabel}
- Confidence: ${result.confidence.toFixed(2)}%
- Osteophytes: ${result.osteophyteSeverity ?? "N/A"}
- Joint space narrowing: ${result.jointSpaceNarrowing ?? "N/A"}
- Subchondral sclerosis: ${result.subchondralSclerosis ?? "N/A"}
- Bone texture: ${result.boneTexture ?? "N/A"}
- Affected compartment: ${result.affectedCompartment ?? "N/A"}
- Findings: ${result.overallFindings ?? result.summary}

SIMILAR REFERENCE CASES FROM DATABASE:
${similarSummary || "No similar cases available."}

You can see the uploaded knee X-ray image. Answer questions about the image, the predicted grade, and how it compares to the similar cases. Be concise and clinically grounded.`;

    // imageBase64 may be a URL (/uploads/...) or actual base64 — handle both
    let base64Data;
    if (imageBase64.startsWith("data:image")) {
      base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    } else {
      const filename = path.basename(decodeURIComponent(imageBase64));
      const filePath = path.join("uploads", filename);
      const fileBuffer = await fs.readFile(filePath);
      base64Data = fileBuffer.toString("base64");
    }

    // map conversation history to OpenAI-compatible format.
    // the first user message includes the image so the model can see the X-ray.
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg, index) => {
        if (msg.role === "user" && index === 0) {
          return {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64Data}` },
              },
              { type: "text", text: msg.content },
            ],
          };
        }
        return {
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        };
      }),
    ];

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: chatMessages,
          max_tokens: 1024,
          temperature: 0.4,
        }),
      },
    );

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      throw new Error(`Groq API error (${groqResponse.status}): ${err}`);
    }

    const groqData = await groqResponse.json();
    const reply =
      groqData.choices?.[0]?.message?.content ?? "No response generated.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat failed:", err);
    return res.status(500).json({ message: "Chat request failed." });
  }
});
// ─── End Chat endpoint ────────────────────────────────────────────────────────

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

app.get("/api/v1/images", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const images = db.collection("images");

    const docs = await images
      .find({ "uploadedBy.userId": req.user.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const result = docs.map((doc) => ({
      id: doc._id.toString(),
      fileUrl: doc.fileUrl,
      originalName: doc.originalName,
      contentType: doc.contentType,
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt,
      imageData: doc.imageData || null,
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch images." });
  }
});

app.delete("/api/v1/images/:imageId", requireAuth, async (req, res) => {
  try {
    const { imageId } = req.params;

    if (!ObjectId.isValid(imageId)) {
      return res.status(400).json({ message: "Invalid image id." });
    }

    const db = getDb();
    const images = db.collection("images");
    const predictions = db.collection("predictions");
    const chatHistories = db.collection("chatHistories");

    const imageDoc = await images.findOne({
      _id: new ObjectId(imageId),
      "uploadedBy.userId": req.user.userId,
    });

    if (!imageDoc) {
      return res.status(404).json({ message: "Image not found." });
    }

    const predictionDocs = await predictions
      .find({
        imageId,
        userId: req.user.userId,
      })
      .toArray();

    const predictionIds = predictionDocs.map((doc) => doc._id.toString());

    if (predictionIds.length > 0) {
      await chatHistories.deleteMany({
        userId: req.user.userId,
        predictionId: { $in: predictionIds },
      });
    }

    const predictionDeleteResult = await predictions.deleteMany({
      imageId,
      userId: req.user.userId,
    });

    const imageDeleteResult = await images.deleteOne({
      _id: new ObjectId(imageId),
      "uploadedBy.userId": req.user.userId,
    });

    if (imageDoc.fileUrl && imageDoc.fileUrl.startsWith("/uploads/")) {
      const filename = path.basename(decodeURIComponent(imageDoc.fileUrl));
      const localFilePath = path.join("uploads", filename);

      try {
        await fs.unlink(localFilePath);
      } catch {
        // Ignore missing files because Render/local uploads may be ephemeral.
      }
    }

    return res.status(200).json({
      ok: true,
      deletedImageCount: imageDeleteResult.deletedCount,
      deletedPredictionCount: predictionDeleteResult.deletedCount,
      deletedChatHistoryCount: predictionIds.length,
    });
  } catch (err) {
    console.error("Delete image failed:", err);
    return res.status(500).json({ message: "Failed to delete image." });
  }
});

app.get("/api/v1/predictions", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const predictions = db.collection("predictions");

    const docs = await predictions
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const result = docs.map((doc) => ({
      id: doc._id.toString(),
      imageId: doc.imageId,
      fileUrl: doc.fileUrl,
      result: doc.result,
      createdAt: doc.createdAt,
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch predictions." });
  }
});

app.get("/api/v1/predictions/export/csv", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const predictions = db.collection("predictions");

    const docs = await predictions
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const csv = `\uFEFF${buildPredictionsCsv(docs)}`;
    const datePart = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="predictions-${datePart}.csv"`,
    );

    return res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Failed to export predictions CSV." });
  }
});

app.post("/api/v1/similar", requireAuth, async (req, res) => {
  try {
    const { fileUrl, grade } = req.body || {};

    if (
      !fileUrl ||
      typeof fileUrl !== "string" ||
      !fileUrl.startsWith("/uploads/")
    ) {
      return res.status(400).json({ message: "Invalid fileUrl." });
    }

    const decodedFileUrl = decodeURIComponent(fileUrl);
    const filename = path.basename(decodedFileUrl);
    const localFilePath = path.join("uploads", filename);

    try {
      await fs.access(localFilePath);
    } catch {
      return res.status(404).json({ message: "File not found." });
    }

    const fileBuffer = await fs.readFile(localFilePath);
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: "image/png" });
    form.append("file", blob, filename);

    const gradeMap = {
      "Grade 0": 0,
      "Grade 1": 1,
      "Grade 2": 2,
      "Grade 3": 3,
      "Grade 4": 4,
    };
    const gradeIndex =
      grade !== undefined && gradeMap[grade] !== undefined
        ? gradeMap[grade]
        : null;

    const mlUrl =
      gradeIndex !== null
        ? `${ML_SERVICE_URL}/similar?kl_grade=${gradeIndex}`
        : `${ML_SERVICE_URL}/similar`;

    const response = await fetch(mlUrl, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML service error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Similar cases failed:", err);
    return res.status(500).json({ message: "Similar cases fetch failed." });
  }
});

// ─── Quiz endpoints ───────────────────────────────────────────────────────────
// Proxies quiz questions from ML service and handles score persistence.

// get a random quiz question from ML service
app.get("/api/v1/quiz/question", requireAuth, async (req, res) => {
  try {
    const { difficulty = "medium" } = req.query;
    const response = await fetch(
      `${ML_SERVICE_URL}/quiz/question?difficulty=${difficulty}`,
    );
    if (!response.ok) throw new Error(`ML service error (${response.status})`);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Quiz question failed:", err);
    return res.status(500).json({ message: "Failed to get quiz question." });
  }
});

// verify answer and return correct grade + explanation
app.post("/api/v1/quiz/submit", requireAuth, async (req, res) => {
  try {
    const { caseId, userAnswer, difficulty, timeLeft } = req.body || {};
    if (!caseId || userAnswer === undefined) {
      return res
        .status(400)
        .json({ message: "caseId and userAnswer are required." });
    }

    const response = await fetch(`${ML_SERVICE_URL}/quiz/answer/${caseId}`);
    if (!response.ok) throw new Error(`ML service error (${response.status})`);
    const data = await response.json();

    const correct = data.correctGrade === userAnswer;

    return res.status(200).json({
      correct,
      correctGrade: data.correctGrade,
      osteophyteSeverity: data.osteophyteSeverity,
      jointSpaceNarrowing: data.jointSpaceNarrowing,
      subchondralSclerosis: data.subchondralSclerosis,
      boneTexture: data.boneTexture,
      affectedCompartment: data.affectedCompartment,
      overallFindings: data.overallFindings,
    });
  } catch (err) {
    console.error("Quiz submit failed:", err);
    return res.status(500).json({ message: "Failed to submit answer." });
  }
});

// save final score to MongoDB
app.post("/api/v1/quiz/score", requireAuth, async (req, res) => {
  try {
    const { score, total, difficulty, accuracy } = req.body || {};
    const db = getDb();
    const scores = db.collection("quizScores");

    await scores.insertOne({
      userId: req.user.userId,
      email: req.user.email,
      score,
      total,
      difficulty,
      accuracy,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Save score failed:", err);
    return res.status(500).json({ message: "Failed to save score." });
  }
});

// get leaderboard — top 10 scores per difficulty
app.get("/api/v1/quiz/leaderboard", requireAuth, async (req, res) => {
  try {
    const { difficulty = "medium" } = req.query;
    const db = getDb();
    const scores = db.collection("quizScores");

    const docs = await scores
      .find({ difficulty })
      .sort({ score: -1, accuracy: -1 })
      .limit(10)
      .toArray();

    const result = docs.map((doc, index) => ({
      rank: index + 1,
      email: doc.email,
      score: doc.score,
      total: doc.total,
      accuracy: doc.accuracy,
      difficulty: doc.difficulty,
      createdAt: doc.createdAt,
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("Leaderboard failed:", err);
    return res.status(500).json({ message: "Failed to get leaderboard." });
  }
});
// ─── End Quiz endpoints ───────────────────────────────────────────────────────
startServer();
