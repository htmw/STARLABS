import { useState, useEffect, useCallback } from "react";
import ImageUploader from "../components/ImageUploader";
import ImageGallery, { type GalleryImage } from "../components/ImageGallery";
import type { AnalysisResult, ProbabilityItem } from "./ResultsPage";

type UploadPageProps = {
  onLogout: () => void;
  onAnalysisReady: (result: AnalysisResult) => void;
};

// Change this if your backend runs on a different port
const BACKEND = "http://localhost:4000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash);
}

function createProbabilitySet(seed: number): ProbabilityItem[] {
  const templates: number[][] = [
    [82, 10, 4, 2, 2],
    [14, 64, 11, 6, 5],
    [8, 18, 52, 14, 8],
    [4, 9, 19, 50, 18],
    [2, 4, 8, 18, 68],
  ];

  const picked = templates[seed % templates.length];

  return picked.map((value, index) => ({
    label: `Grade ${index}`,
    value,
  }));
}

function severityLabelFromGrade(grade: string) {
  switch (grade) {
    case "Grade 0":
      return "None";
    case "Grade 1":
      return "Doubtful";
    case "Grade 2":
      return "Mild";
    case "Grade 3":
      return "Moderate";
    case "Grade 4":
      return "Severe";
    default:
      return "Unknown";
  }
}

function buildMockAnalysis(item: any): AnalysisResult {
  const fileName = item.originalName || "Uploaded image";
  const seed = hashString(`${item.id ?? ""}-${fileName}`);
  const probabilities = createProbabilitySet(seed);
  const best = probabilities.reduce((prev, cur) =>
    cur.value > prev.value ? cur : prev,
  );

  const confidenceJitter = (seed % 7) * 0.31;
  const confidence = Math.min(98, best.value + confidenceJitter);
  const grade = best.label;
  const severityLabel = severityLabelFromGrade(grade);

  return {
    imageUrl: `${BACKEND}${item.fileUrl}`,
    fileName,
    grade,
    confidence,
    probabilities,
    severityLabel,
    summary: `The current model predicts ${grade} (${severityLabel.toLowerCase()} osteoarthritis pattern) with ${confidence.toFixed(
      2,
    )}% confidence. This front-end page is already structured to support the full Streamlit-style workflow, including the uploaded image, predicted grade, confidence score, Grad-CAM explanation, and class probabilities.`,
    isMock: true,
  };
}

function UploadPage({ onLogout, onAnalysisReady }: UploadPageProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const fetchImages = useCallback(async () => {
    try {
      setFetchError("");
      const res = await fetch(`${BACKEND}/api/v1/images`, {
        headers: authHeader(),
      });

      // Token expired → log out cleanly
      if (res.status === 401) {
        onLogout();
        return;
      }

      if (!res.ok) throw new Error(`Failed to load images (${res.status})`);

      const data = await res.json();

      // fileUrl from the backend is a relative path like "/uploads/filename.png"
      // Prepend the backend host so <img src="..."> actually loads
      const mapped: GalleryImage[] = data.map((img: any) => ({
        id: img.id,
        url: `${BACKEND}${img.fileUrl}`,
        originalName: img.originalName,
        contentType: img.contentType,
        createdAt: img.createdAt,
      }));

      setImages(mapped);
    } catch (err: any) {
      setFetchError(err.message || "Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleUploadSuccess = async (items: any[]) => {
    await fetchImages();

    // For now, build a mock analysis result from the newest uploaded item
    // Later, replace this with the real prediction API response
    if (items?.length > 0) {
      const newest = items[0];
      const result = buildMockAnalysis(newest);
      onAnalysisReady(result);
    }
  };

  const addMockImage = () => {
    setImages((prev) => [
      {
        id: String(Date.now()),
        url: "https://picsum.photos/300/300",
        title: "Mock Image",
      },
      ...prev,
    ]);
  };

  return (
    <main className="upload-page">
      <div className="upload-card">
        <div className="upload-header">
          <h1>KneeVision</h1>
          <button className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </div>

        <p className="upload-subtitle">Upload and review knee X-ray images</p>

        <ImageUploader onUploadSuccess={handleUploadSuccess} />

        <h2 className="upload-section-title">Gallery</h2>

        {loading ? (
          <p className="upload-gallery-empty">Loading images…</p>
        ) : fetchError ? (
          <p className="upload-gallery-empty" style={{ color: "#c0392b" }}>
            {fetchError}
          </p>
        ) : images.length === 0 ? (
          <p className="upload-gallery-empty">
            No images yet. Upload your first X-ray above.
          </p>
        ) : (
          <ImageGallery images={images} />
        )}

        <div className="upload-actions">
          <button className="secondary-button" onClick={addMockImage}>
            Add Mock Image
          </button>
        </div>
      </div>
    </main>
  );
}

export default UploadPage;