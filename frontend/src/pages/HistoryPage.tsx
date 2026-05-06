import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "../components/AppShell";
import type { GalleryImage } from "../components/ImageGallery";
import Tooltip from "../components/Tooltip";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

type HistoryPageProps = {
  onLogout: () => void;
  onGoToDashboard: () => void;
  onGoToUpload: () => void;
  onGoToQuiz: () => void;
  onOpenHistoryImage: (image: GalleryImage) => void;
  onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
};

type SortOption = "newest" | "oldest" | "name-smart";
type FilterOption =
  | "all"
  | "today"
  | "week"
  | "month"
  | "within-6-months"
  | "older-6-months";
type GradeFilterOption =
  | "all-grades"
  | "Grade 0"
  | "Grade 1"
  | "Grade 2"
  | "Grade 3"
  | "Grade 4";

type HistoryImage = GalleryImage & {
  grade?: string;
  confidence?: number;
  severityLabel?: string;
};

type SavedPrediction = {
  imageId: string;
  fileUrl: string;
  result: {
    grade: string;
    confidence: number;
    severityLabel?: string;
    probabilities?: { label: string; value: number }[];
    summary?: string;
    heatmapUrl?: string;
  };
  createdAt?: string;
};

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getTimeValue(dateString?: string) {
  if (!dateString) return 0;
  const time = new Date(dateString).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfWeek() {
  const today = getStartOfToday();
  const day = today.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(today);
  start.setDate(today.getDate() - diffToMonday);
  return start;
}

function getStartOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getSixMonthsAgo() {
  const now = new Date();
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - 6);
  return threshold;
}

function isTodayUpload(dateString?: string) {
  if (!dateString) return false;
  const created = new Date(dateString);
  return created >= getStartOfToday();
}

function isThisWeekUpload(dateString?: string) {
  if (!dateString) return false;
  const created = new Date(dateString);
  return created >= getStartOfWeek();
}

function isThisMonthUpload(dateString?: string) {
  if (!dateString) return false;
  const created = new Date(dateString);
  return created >= getStartOfMonth();
}

function isWithinLast6Months(dateString?: string) {
  if (!dateString) return false;
  const created = new Date(dateString);
  return created >= getSixMonthsAgo();
}

function getCategoryRank(char: string) {
  if (/[0-9]/.test(char)) return 0;
  if (/[A-Za-z]/.test(char)) return 1;
  return 2;
}

function compareDigitRuns(aRun: string, bRun: string) {
  const aTrimmed = aRun.replace(/^0+/, "") || "0";
  const bTrimmed = bRun.replace(/^0+/, "") || "0";

  if (aTrimmed.length !== bTrimmed.length) {
    return aTrimmed.length - bTrimmed.length;
  }

  if (aTrimmed !== bTrimmed) {
    return aTrimmed < bTrimmed ? -1 : 1;
  }

  if (aRun.length !== bRun.length) {
    return aRun.length - bRun.length;
  }

  return 0;
}

function compareFileNamesSmart(aNameRaw: string, bNameRaw: string) {
  const aName = aNameRaw || "";
  const bName = bNameRaw || "";

  let i = 0;
  let j = 0;

  while (i < aName.length && j < bName.length) {
    const aChar = aName[i];
    const bChar = bName[j];

    const aRank = getCategoryRank(aChar);
    const bRank = getCategoryRank(bChar);

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    if (aRank === 0 && bRank === 0) {
      let iEnd = i;
      let jEnd = j;

      while (iEnd < aName.length && /[0-9]/.test(aName[iEnd])) iEnd++;
      while (jEnd < bName.length && /[0-9]/.test(bName[jEnd])) jEnd++;

      const aRun = aName.slice(i, iEnd);
      const bRun = bName.slice(j, jEnd);

      const digitCompare = compareDigitRuns(aRun, bRun);
      if (digitCompare !== 0) return digitCompare;

      i = iEnd;
      j = jEnd;
      continue;
    }

    if (aRank === 1 && bRank === 1) {
      const aUpper = aChar.toUpperCase();
      const bUpper = bChar.toUpperCase();

      if (aUpper !== bUpper) {
        return aUpper < bUpper ? -1 : 1;
      }

      if (aChar !== bChar) {
        const aIsUpper = aChar === aUpper;
        const bIsUpper = bChar === bUpper;

        if (aIsUpper !== bIsUpper) {
          return aIsUpper ? -1 : 1;
        }
      }

      i++;
      j++;
      continue;
    }

    if (aChar !== bChar) {
      return aChar < bChar ? -1 : 1;
    }

    i++;
    j++;
  }

  if (aName.length !== bName.length) {
    return aName.length - bName.length;
  }

  return 0;
}

function compareByNewest(a?: string, b?: string) {
  return getTimeValue(b) - getTimeValue(a);
}

function getExportFilename(response: Response) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);

  if (match?.[1]) {
    return match[1];
  }

  const datePart = new Date().toISOString().slice(0, 10);
  return `predictions-${datePart}.csv`;
}

function getAverageConfidence(images: HistoryImage[]) {
  const values = images
    .map((img) => img.confidence)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function HistoryPage({
  onLogout,
  onGoToDashboard,
  onGoToUpload,
  onGoToQuiz,
  onOpenHistoryImage,
  onSearchCase,
}: HistoryPageProps) {
  const [images, setImages] = useState<HistoryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<HistoryImage | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [gradeFilter, setGradeFilter] =
    useState<GradeFilterOption>("all-grades");

  const fetchHistory = useCallback(async () => {
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
        throw new Error(`Failed to load images (${imagesRes.status})`);
      }

      if (!predictionsRes.ok) {
        throw new Error(
          `Failed to load predictions (${predictionsRes.status})`,
        );
      }

      const imageData = await imagesRes.json();
      const predictionData: SavedPrediction[] = await predictionsRes.json();

      const predictionMap = new Map(
        predictionData.map((prediction) => [prediction.imageId, prediction]),
      );

      const mapped: HistoryImage[] = imageData.map((img: any) => {
        const savedPrediction = predictionMap.get(img.id);

        return {
          id: img.id,
          url: img.imageData || `${BACKEND}${img.fileUrl}`,
          fileUrl: img.fileUrl,
          originalName: img.originalName,
          contentType: img.contentType,
          createdAt: img.createdAt,
          grade: savedPrediction?.result.grade,
          confidence: savedPrediction?.result.confidence,
          severityLabel: savedPrediction?.result.severityLabel,
        };
      });

      setImages(mapped);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not load history.";
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportCsv = async () => {
    try {
      setExportError("");
      setExporting(true);

      const res = await fetch(`${BACKEND}/api/v1/predictions/export/csv`, {
        headers: authHeader(),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `CSV export failed (${res.status})`,
        );
      }

      const blob = await res.blob();
      const filename = getExportFilename(res);
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not export CSV.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDelete = (image: HistoryImage) => {
    if (!image.id) {
      setDeleteError("Missing image id. Could not delete this analysis.");
      return;
    }

    setDeleteError("");
    setPendingDelete(image);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete?.id) {
      setDeleteError("Missing image id. Could not delete this analysis.");
      setPendingDelete(null);
      return;
    }

    const imageId = pendingDelete.id;

    try {
      setDeleteError("");
      setDeletingId(imageId);

      const res = await fetch(`${BACKEND}/api/v1/images/${imageId}`, {
        method: "DELETE",
        headers: authHeader(),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `Delete failed (${res.status})`);
      }

      setImages((current) => current.filter((img) => img.id !== imageId));
      setPendingDelete(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not delete this analysis.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const displayedImages = useMemo(() => {
    let next = [...images];

    if (filterBy === "today") {
      next = next.filter((img) => isTodayUpload(img.createdAt));
    } else if (filterBy === "week") {
      next = next.filter((img) => isThisWeekUpload(img.createdAt));
    } else if (filterBy === "month") {
      next = next.filter((img) => isThisMonthUpload(img.createdAt));
    } else if (filterBy === "within-6-months") {
      next = next.filter((img) => isWithinLast6Months(img.createdAt));
    } else if (filterBy === "older-6-months") {
      next = next.filter((img) => !isWithinLast6Months(img.createdAt));
    }

    if (gradeFilter !== "all-grades") {
      next = next.filter((img) => img.grade === gradeFilter);
    }

    if (sortBy === "newest") {
      next.sort((a, b) => compareByNewest(a.createdAt, b.createdAt));
    } else if (sortBy === "oldest") {
      next.sort((a, b) => compareByNewest(b.createdAt, a.createdAt));
    } else if (sortBy === "name-smart") {
      next.sort((a, b) => {
        const aName = a.originalName || a.title || "";
        const bName = b.originalName || b.title || "";

        const nameCompare = compareFileNamesSmart(aName, bName);
        if (nameCompare !== 0) return nameCompare;

        return compareByNewest(a.createdAt, b.createdAt);
      });
    }

    return next;
  }, [images, sortBy, filterBy, gradeFilter]);

  const averageConfidence = getAverageConfidence(images);
  const predictedCount = images.filter((img) => img.grade).length;

  return (
    <AppShell
      currentPage="history"
      title="Analysis History"
      subtitle="Browse saved uploads, filter AI predictions, and export results for review."
      onGoToDashboard={onGoToDashboard}
      onGoToUpload={onGoToUpload}
      onGoToQuiz={onGoToQuiz}
      onLogout={onLogout}
      onSearchCase={onSearchCase}
    >
      <section className="kv-history-summary-grid">
        <div className="kv-stat-card">
          <span>Total Records</span>
          <strong>{images.length}</strong>
        </div>

        <div className="kv-stat-card">
          <span>Predicted Cases</span>
          <strong>{predictedCount}</strong>
        </div>

        <div className="kv-stat-card">
          <span>Avg Confidence</span>
          <strong>
            {averageConfidence !== null
              ? `${averageConfidence.toFixed(2)}%`
              : "N/A"}
          </strong>
        </div>
      </section>

      <section className="kv-panel kv-history-panel">
        <div className="kv-panel-header kv-history-panel-header">
          <div>
            <h3>
              <Tooltip text="Saved AI analyses for the current user.">
                <span>Saved Analysis Records</span>
              </Tooltip>
            </h3>
            <p>
              Filter by upload date, predicted KL grade, or filename order.
            </p>
          </div>

          <Tooltip text="Download prediction history for offline review.">
            <button
              type="button"
              className="kv-history-export-button"
              onClick={handleExportCsv}
              disabled={exporting || loading}
            >
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </Tooltip>
        </div>

        <div className="kv-history-toolbar">
          <div className="upload-toolbar-group">
            <label htmlFor="history-filter">
              <Tooltip text="Filter analyses by upload date.">
                <span>Filter</span>
              </Tooltip>
            </label>
            <select
              id="history-filter"
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            >
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="within-6-months">Last 6 months</option>
              <option value="older-6-months">Older than 6 months</option>
            </select>
          </div>

          <div className="upload-toolbar-group">
            <label htmlFor="history-grade-filter">
              <Tooltip text="Filter records by predicted KL grade.">
                <span>Grade</span>
              </Tooltip>
            </label>
            <select
              id="history-grade-filter"
              value={gradeFilter}
              onChange={(e) =>
                setGradeFilter(e.target.value as GradeFilterOption)
              }
            >
              <option value="all-grades">All Grades</option>
              <option value="Grade 0">Grade 0</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
            </select>
          </div>

          <div className="upload-toolbar-group">
            <label htmlFor="history-sort">
              <Tooltip text="Control display order for saved analyses.">
                <span>Sort</span>
              </Tooltip>
            </label>
            <select
              id="history-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-smart">Name (0-9, A-Z)</option>
            </select>
          </div>
        </div>

        {exportError ? (
          <div className="kv-history-error">{exportError}</div>
        ) : null}

        {deleteError ? (
          <div className="kv-history-error">{deleteError}</div>
        ) : null}

        {loading ? (
          <div className="kv-empty-state">Loading history...</div>
        ) : fetchError ? (
          <div className="kv-history-error">{fetchError}</div>
        ) : images.length === 0 ? (
          <div className="kv-empty-state">
            No analyses yet. Upload your first knee X-ray.
          </div>
        ) : displayedImages.length === 0 ? (
          <div className="kv-empty-state">
            No analyses match the current filter.
          </div>
        ) : (
          <div className="kv-history-grid">
            {displayedImages.map((img) => (
              <div
                key={img.id}
                className="kv-history-card"
                role="button"
                tabIndex={0}
                onClick={() => onOpenHistoryImage(img)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onOpenHistoryImage(img);
                  }
                }}
              >
                <div className="kv-history-image">
                  {img.url ? (
                    <img
                      src={img.url}
                      alt={img.originalName || "History image"}
                    />
                  ) : (
                    <div className="gallery-card-empty">No preview</div>
                  )}
                </div>

                <div className="kv-history-card-body">
                  <p className="kv-history-card-name">
                    {img.originalName || "Uploaded image"}
                  </p>

                  <p className="kv-history-card-date">
                    {img.createdAt
                      ? new Date(img.createdAt).toLocaleString()
                      : "Unknown upload time"}
                  </p>

                  <div className="kv-history-badges">
                    <span className="kv-history-badge">
                      <Tooltip text="Predicted Kellgren-Lawrence grade.">
                        <span>{img.grade || "No grade"}</span>
                      </Tooltip>
                    </span>

                    <span className="kv-history-badge">
                      <Tooltip text="Model certainty for this prediction.">
                        <span>
                          {typeof img.confidence === "number"
                            ? `${img.confidence.toFixed(2)}%`
                            : "N/A"}
                        </span>
                      </Tooltip>
                    </span>

                    <span className="kv-history-badge kv-history-badge--soft">
                      <Tooltip text="Readable severity band from KL grade.">
                        <span>{img.severityLabel || "Unknown"}</span>
                      </Tooltip>
                    </span>
                  </div>

                  <button
                    type="button"
                    className="kv-history-delete-button"
                    disabled={deletingId === img.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestDelete(img);
                    }}
                  >
                    {deletingId === img.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingDelete ? (
        <div
          className="kv-confirm-backdrop"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="kv-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kv-confirm-icon">!</div>

            <div className="kv-confirm-content">
              <h3 id="delete-confirm-title">Delete this analysis?</h3>
              <p>
                This will remove the uploaded image, its AI prediction, and any
                related chat history. This action cannot be undone.
              </p>

              <div className="kv-confirm-file">
                {pendingDelete.originalName || "Uploaded image"}
              </div>
            </div>

            <div className="kv-confirm-actions">
              <button
                type="button"
                className="kv-confirm-cancel"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId === pendingDelete.id}
              >
                Cancel
              </button>

              <button
                type="button"
                className="kv-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={deletingId === pendingDelete.id}
              >
                {deletingId === pendingDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default HistoryPage;