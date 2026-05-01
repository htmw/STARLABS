import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

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
};

type Props = {
  onUploadSuccess?: (items: UploadRecord[]) => void;
  presignEndpoint?: string;
  registerEndpoint?: string;
};

type Toast = { msg: string; type: "success" | "error" } | null;

const defaultAPI = {
  presign: `${BACKEND}/api/v1/uploads/presign`,
  register: `${BACKEND}/api/v1/images`,
};

const isDicom = (file: File) => file.name.toLowerCase().endsWith(".dcm");

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ImageUploader({
  onUploadSuccess,
  presignEndpoint = defaultAPI.presign,
  registerEndpoint = defaultAPI.register,
}: Props) {
  const [files, setFiles] = useState<(File & { preview?: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Auto-dismiss toast after 3.5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    };
  }, [files]);

  const onDrop = useCallback((accepted: File[]) => {
    // Revoke previous previews before replacing to avoid mid-session memory leaks
    setFiles((prev) => {
      prev.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      return accepted.map((f) =>
        Object.assign(f, {
          preview: !isDicom(f) ? URL.createObjectURL(f) : undefined,
        }),
      );
    });
  }, []);

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

  const canUpload = files.length > 0 && !uploading;

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);

    // Read auth token once outside the loop
    const headers = authHeader();

    try {
      const savedItems: UploadRecord[] = [];

      for (const file of files) {
        const contentType =
          file.type ||
          (isDicom(file) ? "application/dicom" : "application/octet-stream");

        // Step 1: Presign — get upload URL + final fileUrl
        const presignRes = await fetch(presignEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ filename: file.name, contentType }),
        });

        if (!presignRes.ok) {
          throw new Error(`Presign failed (${presignRes.status})`);
        }

        const presign: PresignResponse = await presignRes.json();

        // Step 2: PUT raw file bytes to the upload URL returned by presign.
        // presign.uploadUrl is a relative path like /api/v1/uploads/:key
        // so we prefix it with BACKEND to make it absolute for Render.
        // presign.headers already contains the correct Content-Type.
        const absoluteUploadUrl = presign.uploadUrl.startsWith("http")
          ? presign.uploadUrl
          : `${BACKEND}${presign.uploadUrl}`;

        const uploadRes = await fetch(absoluteUploadUrl, {
          method: presign.method || "PUT",
          headers: presign.headers ?? { "Content-Type": contentType },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed (${uploadRes.status})`);
        }

        // Step 3: Register the image metadata in our backend
        const registerRes = await fetch(registerEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            fileUrl: presign.fileUrl,
            originalName: file.name,
            contentType,
          }),
        });

        if (!registerRes.ok) {
          throw new Error(`Register failed (${registerRes.status})`);
        }

        savedItems.push(await registerRes.json());
      }

      onUploadSuccess?.(savedItems);
      setFiles([]);
      setToast({
        msg: `${savedItems.length} image${savedItems.length > 1 ? "s" : ""} uploaded!`,
        type: "success",
      });
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Upload failed";
      setToast({ msg: message, type: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div
        {...getRootProps()}
        className={`dropzone-root${isDragActive ? " dz-active" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-icon">
          <svg viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="dropzone-title">
          {isDragActive
            ? "Release to add files"
            : "Drag & drop or click to browse"}
        </p>
        <p className="dropzone-sub">
          Supports JPG, PNG, WebP, DICOM · batch uploads OK
        </p>
        <div className="dropzone-types">
          {["JPG", "PNG", "WebP", "DICOM"].map((t) => (
            <span key={t} className="dropzone-pill">
              {t}
            </span>
          ))}
        </div>
      </div>

      {files.length > 0 && (
        <div className="dropzone-previews">
          {files.map((f) => (
            <div key={f.name} className="preview-item">
              {!isDicom(f) && f.preview ? (
                <img src={f.preview} alt={f.name} />
              ) : (
                <div className="preview-dicom">
                  <svg viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>DICOM</span>
                </div>
              )}
              <div className="preview-name">{f.name}</div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="upload-action-row">
          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={!canUpload}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <span className="upload-file-count">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </span>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <div className="toast-dot" />
          {toast.msg}
        </div>
      )}
    </>
  );
}
