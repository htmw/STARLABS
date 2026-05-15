import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";

import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

// const BACKEND = "http://localhost:4000";

function getUserLabel() {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return "Researcher";
    const user = JSON.parse(rawUser);
    return user.username || user.email || "Researcher";
  } catch {
    return "Researcher";
  }
}

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
    grade?: string | number;
    severityLabel?: string;
  };
  createdAt?: string;
};

type GradeNumber = 0 | 1 | 2 | 3 | 4;

type GradeMeta = {
  value: GradeNumber;
  label: string;
  severity: string;
  description: string;
  color: string;
};

const GRADE_META: GradeMeta[] = [
  {
    value: 0,
    label: "Grade 0",
    severity: "Normal",
    description: "No radiographic features of osteoarthritis.",
    color: "#38d989",
  },
  {
    value: 1,
    label: "Grade 1",
    severity: "Doubtful",
    description: "Possible osteophytic lipping or doubtful narrowing.",
    color: "#b9ef3f",
  },
  {
    value: 2,
    label: "Grade 2",
    severity: "Mild",
    description: "Definite osteophytes with possible joint space narrowing.",
    color: "#f5df2e",
  },
  {
    value: 3,
    label: "Grade 3",
    severity: "Moderate",
    description: "Multiple osteophytes with definite joint space narrowing.",
    color: "#f7a928",
  },
  {
    value: 4,
    label: "Grade 4",
    severity: "Severe",
    description: "Large osteophytes, marked narrowing, and severe sclerosis.",
    color: "#ff6b6b",
  },
];

const DONUT_RADIUS = 56;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isGradeNumber(value: number): value is GradeNumber {
  return value >= 0 && value <= 4 && Number.isInteger(value);
}

function getGradeNumber(value?: string | number): GradeNumber | null {
  if (typeof value === "number" && isGradeNumber(value)) {
    return value;
  }

  const match = String(value ?? "").match(/(?:grade\s*)?([0-4])/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return isGradeNumber(parsed) ? parsed : null;
}

function formatCaseCount(count: number) {
  return count === 1 ? "1 case" : `${count} cases`;
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
  const [predictions, setPredictions] = useState<SavedPrediction[]>([]);
  const [hoveredGrade, setHoveredGrade] = useState<GradeNumber | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

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
        setPredictions(predictionData);
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

  const gradeDistribution = GRADE_META.map((grade) => {
    const count = predictions.filter(
      (prediction) => getGradeNumber(prediction.result?.grade) === grade.value,
    ).length;

    return {
      ...grade,
      count,
    };
  });

  const predictedCases = gradeDistribution.reduce(
    (sum, grade) => sum + grade.count,
    0,
  );

  const maxGradeCount = Math.max(
    1,
    ...gradeDistribution.map((grade) => grade.count),
  );

  let donutOffset = 0;
  const donutSegments = gradeDistribution.map((grade) => {
    const percentage = predictedCases > 0 ? grade.count / predictedCases : 0;
    const dash = percentage * DONUT_CIRCUMFERENCE;

    const segment = {
      ...grade,
      dash,
      offset: donutOffset,
      percentage,
    };

    donutOffset += dash;
    return segment;
  });

  const activeGrade =
    gradeDistribution.find((grade) => grade.value === hoveredGrade) ||
    gradeDistribution.find((grade) => grade.count > 0) ||
    gradeDistribution[0];

  const activePercentage =
    predictedCases > 0 ? (activeGrade.count / predictedCases) * 100 : 0;

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

             <h2>Hey, Dr. {getUserLabel()}</h2>
{/* <p style={{color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '8px'}}>
  Start a new knee osteoarthritis analysis
</p> */}

              <p>
                {/* Upload a knee X-ray image, run AI-assisted KL grade prediction,
                and review confidence, probability breakdown, and saved history
                in one workspace. */}

                What'd you like to do today?
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

          <section className="kv-dashboard-distribution-panel">
            <div className="kv-dashboard-distribution-header">
              <div>
                <h3>KL Grade Distribution</h3>
                <p>Based on saved AI prediction results.</p>
              </div>

              <div className="kv-dashboard-distribution-total">
                <strong>{predictedCases}</strong>
                <span>Predicted Cases</span>
              </div>
            </div>

            {predictedCases === 0 ? (
              <div className="kv-dashboard-distribution-empty">
                No prediction data yet. Upload and analyze knee X-ray images to
                generate a KL grade distribution.
              </div>
            ) : (
              <div className="kv-dashboard-distribution-body">
                <div className="kv-grade-bars">
                  {gradeDistribution.map((grade) => {
                    const width = `${(grade.count / maxGradeCount) * 100}%`;

                    return (
                      <button
                        key={grade.value}
                        type="button"
                        className={`kv-grade-bar-row${hoveredGrade === grade.value
                          ? " kv-grade-bar-row--active"
                          : ""
                          }`}
                        onMouseEnter={() => setHoveredGrade(grade.value)}
                        onFocus={() => setHoveredGrade(grade.value)}
                        onMouseLeave={() => setHoveredGrade(null)}
                        onBlur={() => setHoveredGrade(null)}
                        aria-label={`${grade.label}, ${formatCaseCount(
                          grade.count,
                        )}`}
                      >
                        <span className="kv-grade-bar-label">
                          {grade.label}
                        </span>

                        <span className="kv-grade-bar-track">
                          <span
                            className="kv-grade-bar-fill"
                            style={{
                              width,
                              background: grade.color,
                            }}
                          />
                        </span>

                        <strong className="kv-grade-bar-count">
                          {formatCaseCount(grade.count)}
                        </strong>
                      </button>
                    );
                  })}
                </div>

                <div className="kv-grade-donut-area">
                  <div className="kv-grade-donut-wrap">
                    <svg
                      className="kv-grade-donut"
                      viewBox="0 0 160 160"
                      role="img"
                      aria-label="KL grade percentage distribution"
                    >
                      <circle
                        className="kv-grade-donut-track"
                        cx="80"
                        cy="80"
                        r={DONUT_RADIUS}
                      />

                      {donutSegments
                        .filter((segment) => segment.count > 0)
                        .map((segment) => (
                          <circle
                            key={segment.value}
                            className={`kv-grade-donut-segment${hoveredGrade === segment.value
                              ? " kv-grade-donut-segment--active"
                              : ""
                              }`}
                            cx="80"
                            cy="80"
                            r={DONUT_RADIUS}
                            stroke={segment.color}
                            strokeDasharray={`${Math.max(
                              segment.dash - 2,
                              0,
                            )} ${DONUT_CIRCUMFERENCE}`}
                            strokeDashoffset={-segment.offset}
                            onMouseEnter={() => setHoveredGrade(segment.value)}
                            onFocus={() => setHoveredGrade(segment.value)}
                            onMouseLeave={() => setHoveredGrade(null)}
                            onBlur={() => setHoveredGrade(null)}
                            tabIndex={0}
                          />
                        ))}
                    </svg>

                    <div className="kv-grade-donut-center">
                      <strong>{predictedCases}</strong>
                      <span>Cases</span>
                    </div>
                  </div>

                  <div className="kv-grade-donut-detail">
                    <span
                      className="kv-grade-donut-dot"
                      style={{ background: activeGrade.color }}
                    />
                    <div>
                      <strong>{activeGrade.label}</strong>
                      <p>
                        {formatCaseCount(activeGrade.count)} ·{" "}
                        {activePercentage.toFixed(1)}% · {activeGrade.severity}
                      </p>
                      <small>{activeGrade.description}</small>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                          {`Case ${String(totalUploads - index).padStart(
                            3,
                            "0",
                          )}`}
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