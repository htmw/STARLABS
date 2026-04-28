import { useState, useEffect, useCallback, useMemo } from "react";
import type { GalleryImage } from "../components/ImageGallery";

type HistoryPageProps = {
  onLogout: () => void;
  onGoToDashboard: () => void;
  onGoToUpload: () => void;
  onOpenHistoryImage: (image: GalleryImage) => void;
};

const BACKEND = "http://localhost:4000";

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

function HistoryPage({
  onLogout,
  onGoToDashboard,
  onGoToUpload,
  onOpenHistoryImage,
}: HistoryPageProps) {
  const [images, setImages] = useState<HistoryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilterOption>("all-grades");

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
          url: `${BACKEND}${img.fileUrl}`,
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
        throw new Error(errorData?.message || `CSV export failed (${res.status})`);
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

  return (
    <main className="upload-page">
      <div className="upload-card">
        <div className="upload-header">
          <h1>KneeVision History</h1>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="secondary-button" onClick={onGoToDashboard}>
              Dashboard
            </button>
            <button className="secondary-button" onClick={onGoToUpload}>
              Upload
            </button>
            <button className="secondary-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        <p className="upload-subtitle">
          Browse past uploads and reopen saved analysis results.
        </p>

        <div
          className="upload-section-heading-row"
          style={{
            alignItems: "center",
          }}
        >
          <h2 className="upload-section-title">Analysis History</h2>

          <button
            type="button"
            className="primary-button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        <div className="upload-gallery-toolbar" style={{ marginBottom: "16px" }}>
          <div className="upload-toolbar-group">
            <label htmlFor="history-filter">Filter</label>
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
            <label htmlFor="history-grade-filter">Grade</label>
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
            <label htmlFor="history-sort">Sort</label>
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
          <p
            className="upload-gallery-empty"
            style={{ color: "#c0392b", padding: "0 0 18px" }}
          >
            {exportError}
          </p>
        ) : null}

        {loading ? (
          <p className="upload-gallery-empty">Loading history…</p>
        ) : fetchError ? (
          <p className="upload-gallery-empty" style={{ color: "#c0392b" }}>
            {fetchError}
          </p>
        ) : images.length === 0 ? (
          <p className="upload-gallery-empty">
            No analyses yet. Upload your first knee X-ray.
          </p>
        ) : displayedImages.length === 0 ? (
          <p className="upload-gallery-empty">
            No analyses match the current filter.
          </p>
        ) : (
          <div className="history-grid">
            {displayedImages.map((img) => (
              <button
                key={img.id}
                type="button"
                className="history-card"
                onClick={() => onOpenHistoryImage(img)}
              >
                <div className="history-card-image">
                  {img.url ? (
                    <img src={img.url} alt={img.originalName || "History image"} />
                  ) : (
                    <div className="gallery-card-empty">No preview</div>
                  )}
                </div>

                <div className="history-card-body">
                  <p className="history-card-name">
                    {img.originalName || "Uploaded image"}
                  </p>
                  <p className="history-card-date">
                    {img.createdAt
                      ? new Date(img.createdAt).toLocaleString()
                      : "Unknown upload time"}
                  </p>

                  <div className="history-badges">
                    <span className="history-badge">
                      {img.grade || "No grade"}
                    </span>
                    <span className="history-badge">
                      {typeof img.confidence === "number"
                        ? `${img.confidence.toFixed(2)}%`
                        : "N/A"}
                    </span>
                    <span className="history-badge">
                      {img.severityLabel || "Unknown"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default HistoryPage;