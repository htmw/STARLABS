import { useState } from "react";
import ImageUploader from "../components/ImageUploader";
import ImageGallery, { type GalleryImage } from "../components/ImageGallery";

type UploadPageProps = {
  onLogout: () => void;
};

function UploadPage({ onLogout }: UploadPageProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);

  const handleUploadSuccess = (items: any[]) => {
    const arr = Array.isArray(items) ? items : [items];
    setImages((prev) => [...arr, ...prev]);
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
        <ImageGallery images={images} />

        {images.length === 0 && (
          <p className="upload-gallery-empty">No images to display yet.</p>
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