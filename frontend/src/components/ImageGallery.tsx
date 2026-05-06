export type GalleryImage = {
  id?: string;
  url?: string;
  fileUrl?: string;
  title?: string;
  originalName?: string;
  createdAt?: string;
  contentType?: string;
  imageData?: string | null;
};

type Props = {
  images: GalleryImage[];
  onImageClick?: (image: GalleryImage) => void;
};

export default function ImageGallery({ images, onImageClick }: Props) {
  if (!images || images.length === 0) {
    return <p className="upload-gallery-empty">No images to display.</p>;
  }

  return (
    <div className="gallery-grid">
      {images.map((img) => {
        const src = img.url || img.fileUrl || "";
        const label = img.title || img.originalName || "Image";
        const key = img.id || src || label;

        if (onImageClick) {
          return (
            <button
              key={key}
              type="button"
              className="gallery-card gallery-card-button"
              onClick={() => onImageClick(img)}
            >
              {src ? (
                <img src={src} alt={label} loading="lazy" />
              ) : (
                <div className="gallery-card-empty">No preview</div>
              )}
              <div className="gallery-card-label">{label}</div>
            </button>
          );
        }

        return (
          <div key={key} className="gallery-card">
            {src ? (
              <img src={src} alt={label} loading="lazy" />
            ) : (
              <div className="gallery-card-empty">No preview</div>
            )}
            <div className="gallery-card-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}