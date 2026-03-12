import { useState } from "react";
import ImageUploader from "../components/ImageUploader";
import ImageGallery, { type GalleryImage } from "../components/ImageGallery";

function UploadPage() {
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
    <>
      <h2 style={{ textAlign: "center", marginTop: 18 }}>STARLABS Upload</h2>

      <ImageUploader onUploadSuccess={handleUploadSuccess} />

      <h2 style={{ textAlign: "center", marginTop: 18 }}>Gallery</h2>
      <ImageGallery images={images} />

      <div style={{ textAlign: "center", marginTop: 10 }}>
        <button onClick={addMockImage} style={{ padding: "8px 12px" }}>
          Add Mock Image
        </button>
      </div>
    </>
  );
}

export default UploadPage;