import { useEffect, useState } from "react";

type DashboardPageProps = {
  onLogout: () => void;
  onGoToUpload: () => void;
};

type DashboardImage = {
  id: string;
  fileUrl: string;
  originalName?: string;
  contentType?: string;
  createdAt?: string;
};

const BACKEND = "http://localhost:4000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function DashboardPage({ onLogout, onGoToUpload }: DashboardPageProps) {
  const [images, setImages] = useState<DashboardImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setFetchError("");

        const res = await fetch(`${BACKEND}/api/v1/images`, {
          headers: authHeader(),
        });

        if (res.status === 401) {
          onLogout();
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to load dashboard data (${res.status})`);
        }

        const data: DashboardImage[] = await res.json();
        setImages(data);
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

    fetchImages();
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
                <h2>N/A</h2>
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
                <button className="secondary-button" disabled>
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
                    <div key={img.id} className="dashboard-recent-card">
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
                    </div>
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