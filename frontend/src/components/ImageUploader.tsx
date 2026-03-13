import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

type UploadRecord = {
  id?: string;
  fileUrl: string;
  originalName?: string;
  contentType?: string;
  createdAt?: string;
};

type PresignResponse = {
  uploadUrl: string;
  method?: string; 
  headers?: Record<string, string>;
  fileUrl: string;
  expiresIn?: number;
};

type Props = {
  onUploadSuccess?: (items: UploadRecord[]) => void;
  presignEndpoint?: string;
  registerEndpoint?: string;
};

const defaultAPI = {
  presign: "/api/v1/uploads/presign",
  register: "/api/v1/images",
};

const isDicom = (file: File) => file.name.toLowerCase().endsWith(".dcm");

export default function ImageUploader({
  onUploadSuccess,
  presignEndpoint = defaultAPI.presign,
  registerEndpoint = defaultAPI.register,
}: Props) {
  const [files, setFiles] = useState<(File & { preview?: string })[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted.map((f) => {
      const dicom = isDicom(f);
      return Object.assign(f, {
        preview: !dicom ? URL.createObjectURL(f) : undefined,
      });
    });
    setFiles(next);
  }, []);

  // previews
  useEffect(() => {
    return () => {
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    };
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/dicom": [".dcm"],
    },
  });

  const canUpload = useMemo(() => files.length > 0 && !uploading, [files.length, uploading]);

  // presign -> PUT -> register
  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);

    try {
      const savedItems: UploadRecord[] = [];

      for (const file of files) {
        const contentType =
          file.type || (isDicom(file) ? "application/dicom" : "application/octet-stream");

        // 1) presign
        const presignRes = await fetch(presignEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType }),
        });
        if (!presignRes.ok) throw new Error(`Presign failed (${presignRes.status})`);
        const presign: PresignResponse = await presignRes.json();

        // 2) upload
        const uploadRes = await fetch(presign.uploadUrl, {
          method: presign.method || "PUT",
          headers: presign.headers || { "Content-Type": contentType },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

        // 3) register
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("You must be logged in to upload images.");
        }

        const registerRes = await fetch(registerEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileUrl: presign.fileUrl,
            originalName: file.name,
            contentType,
          }),
        });

        if (!registerRes.ok) throw new Error(`Register failed (${registerRes.status})`);
        const saved: UploadRecord = await registerRes.json();

        savedItems.push(saved);
      }

      onUploadSuccess?.(savedItems);
      setFiles([]);
      alert("Upload successful!");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #ccc",
          borderRadius: 10,
          padding: 40,
          textAlign: "center",
          background: isDragActive ? "#f0f8ff" : "#fafafa",
          cursor: "pointer",
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? <p>Drop files here…</p> : <p>Drag & drop or click (JPG/PNG/WebP/DICOM)</p>}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        {files.map((f) => {
          const dicom = isDicom(f);
          return (
            <div key={f.name} style={{ border: "1px solid #ddd", padding: 8, width: 150 }}>
              {!dicom && f.preview ? (
                <img
                  src={f.preview}
                  alt={f.name}
                  style={{ width: 130, height: 130, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 130,
                    height: 130,
                    border: "1px dashed #bbb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  DICOM (.dcm)
                </div>
              )}
              <div style={{ fontSize: 12, marginTop: 6, wordBreak: "break-all" }}>{f.name}</div>
            </div>
          );
        })}
      </div>

      {files.length > 0 && (
        <button onClick={handleUpload} disabled={!canUpload} style={{ marginTop: 18, padding: "10px 16px" }}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      )}
    </div>
  );
}