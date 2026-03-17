export type GalleryImage = {
  id?: string;
  url?: string;
  fileUrl?: string;
  title?: string;
  originalName?: string;
};

type Props = {
  images: GalleryImage[];
};

export default function ImageGallery({ images }: Props) {
  if (!images || images.length === 0) {
    return <p className="upload-gallery-empty">No images to display.</p>;
  }

  return (
    <div className="gallery-grid">
      {images.map((img) => {
        const src = img.url || img.fileUrl || "";
        const label = img.title || img.originalName || "Image";

        return (
          <div key={img.id || src || label} className="gallery-card">
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
