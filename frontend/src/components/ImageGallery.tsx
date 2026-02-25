import React from "react";

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
    return <p style={{ textAlign: "center", marginTop: 12 }}>No images to display.</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 16,
        padding: 20,
      }}
    >
      {images.map((img) => {
        const src = img.url || img.fileUrl || "";
        const label = img.title || img.originalName || "Image";

        return (
          <div
            key={img.id || src || label}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
              background: "white",
            }}
          >
            {src ? (
              <img
                src={src}
                alt={label}
                loading="lazy"
                style={{ width: "100%", height: 150, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 150,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "#666",
                  background: "#fafafa",
                }}
              >
                No preview
              </div>
            )}

            <div style={{ padding: 8, textAlign: "center", fontSize: 13 }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}