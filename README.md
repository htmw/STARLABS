# KneeVision — STARLABS

AI-assisted knee X-ray analysis platform. Classifies knee osteoarthritis severity using the Kellgren-Lawrence (KL) grading scale (Grade 0–4) and produces Grad-CAM heatmap explanations.

---

## Project Structure

```
STARLABS/
├── .env.example                  # Root env template (all services)
├── .gitignore
│
├── backend/                      # Node.js / Express API
│   ├── Dockerfile                # Multi-stage production build
│   ├── .dockerignore
│   ├── package.json
│   └── src/
│       ├── index.js              # Express app + all route handlers
│       ├── db.js                 # MongoDB connection singleton
│       └── imageProcessor.js     # sharp-based image preprocessing
│
├── frontend/                     # React 19 + Vite + TypeScript SPA
│   ├── Dockerfile                # Build → nginx multi-stage
│   ├── .dockerignore
│   ├── nginx.conf                # SPA fallback + /api proxy
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx               # Root component + routing state
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── UploadPage.tsx    # Upload + gallery + predict trigger
│       │   └── ResultsPage.tsx   # KL grade + Grad-CAM + probabilities
│       └── components/
│           ├── ImageUploader.tsx # Drag-and-drop uploader
│           ├── ImageGallery.tsx  # User's uploaded X-ray gallery
│           ├── LoginForm.tsx
│           └── RegisterForm.tsx
│
├── ml-service/                   # Python FastAPI + TensorFlow inference
│   ├── Dockerfile                # Expects model.hdf5 mounted at runtime
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── model.hdf5
│   └── app.py                   # /predict endpoint + Grad-CAM logic
│
└── infra/
    ├── docker-compose.yml        # Production: all 4 services
    └── docker-compose.dev.yml    # Dev override: hot-reload
```

---

## Architecture

```
Browser
  │
  ▼
┌─────────────┐   80/443
│   frontend  │  (nginx)      serves React SPA
│   (nginx)   │  ─────────── proxies /api/* → backend:4000
└─────────────┘              proxies /uploads/* → backend:4000
        │
        ▼
┌─────────────┐   :4000
│   backend   │  (Express)
│  (Node.js)  │──────────────▶ MongoDB Atlas (or local mongo:27017)
└─────────────┘
        │ POST /predict (multipart)
        ▼
┌─────────────┐   :8000
│ ml-service  │  (FastAPI + TensorFlow)
│  (Python)   │──────────────▶ model.hdf5 (bind-mounted volume)
└─────────────┘
```

---

## Quick Start (Docker Compose)

### Prerequisites

- Docker Desktop ≥ 4.x
- `model.hdf5` file placed at the repo ml-service floder 

### 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, MONGODB_URI (Atlas or local), MODEL_PATH
```

### 2. Run all services

```bash
cd infra
docker compose up --build
```

| Service    | URL                       |
| ---------- | ------------------------- |
| Frontend   | http://localhost          |
| Backend    | http://localhost:4000     |
| ML Service | http://localhost:8000     |
| MongoDB    | mongodb://localhost:27017 |

### 3. Development mode (hot reload)

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- Backend: Node.js `--watch` reloads on source changes
- Frontend: Vite HMR at http://localhost:5173
- ML Service: uvicorn `--reload` restarts on `app.py` changes

---

## Running Without Docker (local dev)

### MongoDB

Use MongoDB Atlas or run locally:

```bash
docker run -p 27017:27017 mongo:7
```

### ML Service

```bash
cd ml-service
pip install -r requirements.txt
MODEL_PATH=/path/to/model.hdf5 uvicorn app:app --reload --port 8000
```

### Backend

```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, ML_SERVICE_URL
npm install
npm run dev            # nodemon on :4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # Vite on :5173
```

---

## Model File

The `model.hdf5` file is excluded from git (it is large). Distribute it separately.

**For Docker:** place `model.hdf5` next to `infra/docker-compose.yml` and set in `.env`:

```
MODEL_PATH=./model.hdf5
```

The compose file bind-mounts it read-only into the `ml-service` container at `/app/model.hdf5`.

---

## API Reference

### Auth

| Method | Path                  | Auth | Description       |
| ------ | --------------------- | ---- | ----------------- |
| POST   | /api/v1/auth/register | —    | Register new user |
| POST   | /api/v1/auth/login    | —    | Login, get JWT    |

### Upload Flow

| Method | Path                    | Auth | Description                        |
| ------ | ----------------------- | ---- | ---------------------------------- |
| POST   | /api/v1/uploads/presign | —    | Get upload URL + fileUrl           |
| PUT    | /api/v1/uploads/:key    | —    | Upload raw bytes (preprocessed)    |
| POST   | /api/v1/images          | JWT  | Register image metadata in MongoDB |
| GET    | /api/v1/images          | JWT  | List user's uploaded images        |

### Inference

| Method | Path            | Auth | Description                        |
| ------ | --------------- | ---- | ---------------------------------- |
| POST   | /api/v1/predict | JWT  | Run KL-grade prediction + Grad-CAM |

#### Prediction Response

```json
{
  "grade": "Grade 2",
  "confidence": 87.43,
  "severityLabel": "Mild",
  "summary": "The model predicts Grade 2 with 87.43% confidence.",
  "probabilities": [
    { "label": "Grade 0", "value": 1.2 },
    { "label": "Grade 1", "value": 3.5 },
    { "label": "Grade 2", "value": 87.43 },
    { "label": "Grade 3", "value": 6.1 },
    { "label": "Grade 4", "value": 1.77 }
  ],
  "heatmapUrl": "data:image/png;base64,..."
}
```

---

## Image Preprocessing Pipeline

All uploaded images are processed server-side by `backend/src/imageProcessor.js` before storage:

1. **Grayscale conversion** — removes color channels irrelevant to X-ray analysis
2. **Resize to 1024×1024 max** — preserves aspect ratio (`fit: inside`), no upscaling
3. **Lanczos3 resampling** — high-quality downsample
4. **PNG output** — lossless format suitable for medical images

DICOM files (`.dcm`) are stored as-is without preprocessing.

---

## Environment Variables

| Variable               | Service    | Description                                       |
| ---------------------- | ---------- | ------------------------------------------------- |
| `MONGODB_URI`          | backend    | MongoDB connection string                         |
| `JWT_SECRET`           | backend    | Secret for signing JWTs (use a strong random str) |
| `PORT`                 | backend    | Backend HTTP port (default: 4000)                 |
| `ML_SERVICE_URL`       | backend    | URL of the FastAPI service                        |
| `MODEL_PATH`           | ml-service | Path to model.hdf5 inside container               |
| `LAST_CONV_LAYER_NAME` | ml-service | Grad-CAM target layer name                        |
| `VITE_BACKEND_URL`     | frontend   | Backend URL injected at Vite build time           |

---

## Tech Stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite, react-dropzone      |
| Backend    | Node.js 20, Express 5, MongoDB, sharp, bcryptjs |
| ML Service | Python 3.10, FastAPI, TensorFlow 2.12, Grad-CAM |
| Database   | MongoDB Atlas (prod) / MongoDB 7 Docker (dev)   |
| Serving    | nginx 1.27-alpine                               |
| Container  | Docker + Docker Compose                         |
