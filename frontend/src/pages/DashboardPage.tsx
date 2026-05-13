import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";

import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

// const BACKEND = "http://localhost:4000";

type DashboardPageProps = {
  onLogout: () => void;
  onGoToUpload: () => void;
  onGoToHistory: () => void;
  onGoToQuiz: () => void;
  onOpenRecentUpload: (image: DashboardImage) => void;
  onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
  onGoToResearch?: () => void;
};

type DashboardImage = {
  id: string;
  fileUrl: string;
  originalName?: string;
  contentType?: string;
  createdAt?: string;
  imageData?: string;
};

type SavedPrediction = {
  imageId: string;
  fileUrl: string;
  result: {
    confidence?: number;
    grade?: string;
    severityLabel?: string;
  };
  createdAt?: string;
};

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function DashboardPage({
  onLogout,
  onGoToUpload,
  onGoToHistory,
  onGoToQuiz,
  onOpenRecentUpload,
  onSearchCase,
  onGoToResearch,
}: DashboardPageProps) {
  const [images, setImages] = useState<DashboardImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [avgConfidence, setAvgConfidence] = useState<number | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setFetchError("");

        const [imagesRes, predictionsRes] = await Promise.all([
          fetch(`${BACKEND}/api/v1/images`, {
            headers: authHeader(),
          }),
          fetch(`${BACKEND}/api/v1/predictions`, {
            headers: authHeader(),
          }),
        ]);

        if (imagesRes.status === 401 || predictionsRes.status === 401) {
          onLogout();
          return;
        }

        if (!imagesRes.ok) {
          throw new Error(
            `Failed to load dashboard images (${imagesRes.status})`,
          );
        }

        if (!predictionsRes.ok) {
          throw new Error(
            `Failed to load dashboard predictions (${predictionsRes.status})`,
          );
        }

        const imageData: DashboardImage[] = await imagesRes.json();
        const predictionData: SavedPrediction[] = await predictionsRes.json();

        setImages(imageData);

        const confidenceValues = predictionData
          .map((prediction) => prediction.result?.confidence)
          .filter((value): value is number => typeof value === "number");

        if (confidenceValues.length > 0) {
          const total = confidenceValues.reduce((sum, value) => sum + value, 0);
          setAvgConfidence(total / confidenceValues.length);
        } else {
          setAvgConfidence(null);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Could not load dashboard data.";
        setFetchError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [onLogout]);

  const totalUploads = images.length;
  const recentUploads = images.slice(0, 3);

  return (
    <AppShell
  currentPage="dashboard"
  title="Welcome back"
  subtitle="Review your recent activity and start a new knee X-ray analysis."
  onGoToUpload={onGoToUpload}
  onGoToHistory={onGoToHistory}
  onGoToQuiz={onGoToQuiz}
  onGoToResearch={onGoToResearch}
  onLogout={onLogout}
  onSearchCase={onSearchCase}
>
      {loading ? (
        <p className="kv-loading-message">Loading dashboard...</p>
      ) : fetchError ? (
        <p className="kv-error-message">{fetchError}</p>
      ) : (
        <>
          <section className="kv-dashboard-hero">
            <div className="kv-dashboard-hero-content">
              <span className="kv-dashboard-eyebrow">AI X-ray Workspace</span>

              <h2>Start a new knee osteoarthritis analysis</h2>

              <p>
                Upload a knee X-ray image, run AI-assisted KL grade prediction,
                and review confidence, probability breakdown, and saved history
                in one workspace.
              </p>

              <div className="kv-dashboard-hero-actions">
                <button className="kv-primary-action" onClick={onGoToUpload}>
                  Upload New Image
                </button>

                <button className="kv-secondary-action" onClick={onGoToHistory}>
                  View History
                </button>
              </div>
            </div>
          </section>

          <section className="kv-dashboard-stats">
            <div className="kv-stat-card">
              <span>Total Uploads</span>
              <strong>{totalUploads}</strong>
            </div>

            <div className="kv-stat-card">
              <span>Avg Confidence Score</span>
              <strong>
                {avgConfidence !== null
                  ? `${avgConfidence.toFixed(2)}%`
                  : "N/A"}
              </strong>
            </div>

            <div className="kv-stat-card">
              <span>Recent Uploads</span>
              <strong>{recentUploads.length}</strong>
            </div>
          </section>

          <section className="kv-dashboard-grid">
            <div className="kv-panel">
              <div className="kv-panel-header">
                <div>
                  <h3>Recent Uploads</h3>
                  <p>Open a previous image and review its saved analysis.</p>
                </div>

                <button className="kv-link-button" onClick={onGoToHistory}>
                  View all
                </button>
              </div>

              {recentUploads.length === 0 ? (
                <div className="kv-empty-state">
                  No uploads yet. Start by uploading your first knee X-ray.
                </div>
              ) : (
                <div className="kv-recent-list">
                  {recentUploads.map((img, index) => (
                    <button
                      key={img.id}
                      type="button"
                      className="kv-recent-card"
                      onClick={() => onOpenRecentUpload(img)}
                    >
                      <div className="kv-recent-thumb">
                        <img
                          src={img.imageData || `${BACKEND}${img.fileUrl}`}
                          alt={img.originalName || "Uploaded image"}
                        />
                      </div>

                      <div className="kv-recent-meta">
                        <strong>
                          {`Case ${String(totalUploads - index).padStart(3, "0")}`}
                        </strong>
                        <span>
                          {img.createdAt
                            ? new Date(img.createdAt).toLocaleString()
                            : "Unknown upload time"}
                        </span>
                      </div>

                      <span className="kv-recent-pill">Open</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="kv-panel">
              <div className="kv-panel-header">
                <div>
                  <h3>Quick Actions</h3>
                  <p>Common workflow shortcuts for research users.</p>
                </div>
              </div>

              <div className="kv-action-list">
                <button
                  type="button"
                  className="kv-action-card kv-action-card--primary"
                  onClick={onGoToUpload}
                >
                  <strong>Upload X-ray</strong>
                  <span>Start a new AI-assisted analysis workflow.</span>
                </button>

                <button
                  type="button"
                  className="kv-action-card"
                  onClick={onGoToHistory}
                >
                  <strong>Review History</strong>
                  <span>Browse previous uploads and saved predictions.</span>
                </button>

                <button
                  type="button"
                  className="kv-action-card"
                  onClick={onGoToQuiz}
                >
                  <strong>Take Quiz</strong>
                  <span>Practice KL grade recognition with guided cases.</span>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

export default DashboardPage;
