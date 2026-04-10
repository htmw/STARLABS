import { useEffect, useState } from "react";

type DashboardPageProps = {
  onLogout: () => void;
  onGoToUpload: () => void;
  onGoToHistory: () => void;
  onOpenRecentUpload: (image: DashboardImage) => void;
};

type DashboardImage = {
  id: string;
  fileUrl: string;
  originalName?: string;
  contentType?: string;
  createdAt?: string;
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

const BACKEND = "http://localhost:4000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function DashboardPage({
  onLogout,
  onGoToUpload,
  onGoToHistory,
  onOpenRecentUpload,
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
          throw new Error(`Failed to load dashboard images (${imagesRes.status})`);
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
          err instanceof Error
            ? err.message
            : "Could not load dashboard data.";
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
    <main className="upload-page">
      <div className="upload-card">
        <div className="upload-header">
          <h1>KneeVision Dashboard</h1>
          <button className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </div>

        <p className="upload-subtitle">
          Welcome back. Review your recent activity and start a new analysis.
        </p>

        {loading ? (
          <p className="upload-gallery-empty">Loading dashboard...</p>
        ) : fetchError ? (
          <p className="upload-gallery-empty" style={{ color: "#c0392b" }}>
            {fetchError}
          </p>
        ) : (
          <>
            <section className="dashboard-stats">
              <div className="dashboard-stat-card">
                <p className="dashboard-stat-label">Total Uploads</p>
                <h2>{totalUploads}</h2>
              </div>

              <div className="dashboard-stat-card">
                <p className="dashboard-stat-label">Avg Confidence Score</p>
                <h2>{avgConfidence !== null ? `${avgConfidence.toFixed(2)}%` : "N/A"}</h2>
              </div>

              <div className="dashboard-stat-card">
                <p className="dashboard-stat-label">Recent Uploads</p>
                <h2>{recentUploads.length}</h2>
              </div>
            </section>

            <section className="dashboard-actions-section">
              <h2 className="upload-section-title">Quick Actions</h2>
              <div className="dashboard-actions">
                <button className="primary-button" onClick={onGoToUpload}>
                  Upload New Image
                </button>
                <button className="secondary-button" onClick={onGoToHistory}>
                  View History
                </button>
                <button className="secondary-button" disabled>
                  Profile
                </button>
              </div>
            </section>

            <section className="dashboard-recent-section">
              <h2 className="upload-section-title">Recent Uploads</h2>

              {recentUploads.length === 0 ? (
                <p className="upload-gallery-empty">
                  No uploads yet. Start by uploading your first knee X-ray.
                </p>
              ) : (
                <div className="dashboard-recent-list">
                  {recentUploads.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      className="dashboard-recent-card dashboard-recent-button"
                      onClick={() => onOpenRecentUpload(img)}
                    >
                      <div className="dashboard-recent-thumb">
                        <img
                          src={`${BACKEND}${img.fileUrl}`}
                          alt={img.originalName || "Uploaded image"}
                        />
                      </div>

                      <div className="dashboard-recent-meta">
                        <p className="dashboard-recent-name">
                          {img.originalName || "Uploaded image"}
                        </p>
                        <p className="dashboard-recent-date">
                          {img.createdAt
                            ? new Date(img.createdAt).toLocaleString()
                            : "Unknown upload time"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default DashboardPage;