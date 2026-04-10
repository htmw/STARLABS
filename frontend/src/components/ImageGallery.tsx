export type GalleryImage = {
  id?: string;
  url?: string;
  fileUrl?: string;
  title?: string;
  originalName?: string;
  contentType?: string;
  createdAt?: string;
};

type Props = {
  images: GalleryImage[];
};

function ImageGallery({ images }: Props) {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="gallery-grid">
      {images.map((img) => {
        const src = img.url || img.fileUrl || "";
        const label = img.title || img.originalName || "Image";

        return (
          <div
            key={img.id || `${label}-${src}`}
            className="gallery-card"
          >
            {src ? (
              <img src={src} alt={label} />
            ) : (
              <div className="gallery-card-empty">No preview</div>
            )}

            <div className="gallery-card-label" title={label}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ImageGallery;