import { useState, useEffect, useCallback } from "react";
import ImageUploader from "../components/ImageUploader";
import ImageGallery, { type GalleryImage } from "../components/ImageGallery";

type UploadPageProps = {
  onLogout: () => void;
};

// Change this if your backend runs on a different port
const BACKEND = "http://localhost:4000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function UploadPage({ onLogout }: UploadPageProps) {
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

  const handleUploadSuccess = async (_items: any[]) => {
    await fetchImages();
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
