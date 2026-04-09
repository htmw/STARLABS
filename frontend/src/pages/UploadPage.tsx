import { useState, useEffect, useCallback, useMemo } from "react";
import ImageUploader from "../components/ImageUploader";
import ImageGallery, { type GalleryImage } from "../components/ImageGallery";
import type { AnalysisResult } from "./ResultsPage";

type UploadPageProps = {
  onLogout: () => void;
  onAnalysisReady: (result: AnalysisResult) => void;
  onGoToDashboard: () => void;
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

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildRealAnalysis(savedItem: any, prediction: any): AnalysisResult {
  return {
    imageUrl: `${BACKEND}${savedItem.fileUrl}`,
    fileName: savedItem.originalName || "Uploaded image",
    grade: prediction.grade,
    confidence: prediction.confidence,
    probabilities: prediction.probabilities || [],
    severityLabel: prediction.severityLabel || "Unknown",
    summary:
      prediction.summary ||
      `The model predicts ${prediction.grade} with ${prediction.confidence}% confidence.`,
    heatmapUrl: prediction.heatmapUrl,
    isMock: false,
  };
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
  const day = today.getDay(); // 0 = Sunday, 1 = Monday, ...
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

function UploadPage({
    onLogout,
    onAnalysisReady,
    onGoToDashboard,
  }: UploadPageProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [predicting, setPredicting] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  const fetchImages = useCallback(async () => {
    try {
      setFetchError("");

      const res = await fetch(`${BACKEND}/api/v1/images`, {
        headers: authHeader(),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      if (!res.ok) throw new Error(`Failed to load images (${res.status})`);

      const data = await res.json();

      const mapped: GalleryImage[] = data.map((img: any) => ({
        id: img.id,
        url: `${BACKEND}${img.fileUrl}`,
        fileUrl: img.fileUrl,
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

    if (items?.length > 0) {
      const newest = items[0];

      try {
        setPredicting(true);

        const res = await fetch(`${BACKEND}/api/v1/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({
            fileUrl: newest.fileUrl,
            originalName: newest.originalName,
          }),
        });

        if (res.status === 401) {
          onLogout();
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(
            errorData?.message || `Prediction failed (${res.status})`,
          );
        }

        const prediction = await res.json();
        const result = buildRealAnalysis(newest, prediction);
        onAnalysisReady(result);
      } catch (err: any) {
        setFetchError(err.message || "Prediction failed.");
      } finally {
        setPredicting(false);
      }
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
  }, [images, sortBy, filterBy]);

  return (
    <main className="upload-page">
      <div className="upload-card">
        <div className="upload-header">
          <h1>KneeVision</h1>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="secondary-button" onClick={onGoToDashboard}>
              Dashboard
            </button>
            <button className="secondary-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        <p className="upload-subtitle">Upload and review knee X-ray images</p>

        <ImageUploader onUploadSuccess={handleUploadSuccess} />

        {predicting ? (
          <p className="upload-gallery-empty" style={{ marginTop: "16px" }}>
            Running AI analysis...
          </p>
        ) : null}

        <div className="upload-section-heading-row">
          <h2 className="upload-section-title">Gallery</h2>

          <div className="upload-gallery-toolbar">
            <div className="upload-toolbar-group">
              <label htmlFor="gallery-filter">Filter</label>
              <select
                id="gallery-filter"
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
              <label htmlFor="gallery-sort">Sort</label>
              <select
                id="gallery-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name-smart">Name (0-9, A-Z)</option>
              </select>
            </div>
          </div>
        </div>

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
        ) : displayedImages.length === 0 ? (
          <p className="upload-gallery-empty">
            No images match the current filter.
          </p>
        ) : (
          <ImageGallery images={displayedImages} />
        )}
      </div>
    </main>
  );
}

export default UploadPage;