import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  ShieldAlert,
  UploadCloud,
  Wrench,
  XCircle,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const OPERATIONS = [
  {
    value: "auto",
    label: "Smart Auto",
    help: "Detect type and apply best processing path",
  },
  {
    value: "unlock",
    label: "Unlock Restrictions",
    help: "Remove non-password restrictions where possible",
  },
  {
    value: "convert",
    label: "Convert & Fix",
    help: "Convert file format while normalizing structure",
  },
  {
    value: "optimize",
    label: "Optimize",
    help: "Compress and strip metadata",
  },
  {
    value: "repair",
    label: "Repair",
    help: "Best-effort re-save for partially corrupted files",
  },
];

const CONVERSION_TARGETS = {
  ".pdf": ["docx"],
  ".docx": ["pdf"],
  ".pptx": ["pdf"],
  ".xlsx": ["pdf"],
  ".jpg": ["pdf"],
  ".jpeg": ["pdf"],
  ".png": ["pdf"],
};

function getExtension(fileName) {
  const splitName = fileName.toLowerCase().split(".");
  return splitName.length > 1 ? `.${splitName.pop()}` : "";
}

function formatBytes(value) {
  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const sizedValue = value / 1024 ** sizeIndex;
  return `${sizedValue.toFixed(sizeIndex === 0 ? 0 : 2)} ${units[sizeIndex]}`;
}

function buildEndpoint(pathname) {
  return API_BASE ? `${API_BASE}${pathname}` : pathname;
}

function FileTypeIcon({ extension }) {
  if ([".jpg", ".jpeg", ".png"].includes(extension)) {
    return <FileImage className="h-8 w-8 text-lagoon" />;
  }

  if (extension === ".xlsx") {
    return <FileSpreadsheet className="h-8 w-8 text-lagoon" />;
  }

  if (extension === ".zip") {
    return <FileArchive className="h-8 w-8 text-lagoon" />;
  }

  return <FileText className="h-8 w-8 text-lagoon" />;
}

export default function App() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [operation, setOperation] = useState("auto");
  const [targetFormat, setTargetFormat] = useState("pdf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState(null);

  const selectedExtension = useMemo(
    () => (selectedFile ? getExtension(selectedFile.name) : ""),
    [selectedFile],
  );

  const availableTargets = useMemo(
    () => CONVERSION_TARGETS[selectedExtension] || [],
    [selectedExtension],
  );

  const operationMeta = useMemo(
    () => OPERATIONS.find((item) => item.value === operation),
    [operation],
  );

  function setFailure(message, reason) {
    setStatus({
      kind: "failed",
      message,
      reason,
    });
  }

  function onPickFile(file) {
    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFailure("Processing failed", "Max file size is 50MB");
      return;
    }

    setSelectedFile(file);
    setStatus(null);

    const nextTargets = CONVERSION_TARGETS[getExtension(file.name)] || [];
    if (nextTargets.length > 0) {
      setTargetFormat(nextTargets[0]);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragActive(false);

    const [file] = event.dataTransfer.files;
    onPickFile(file);
  }

  async function handleSubmit() {
    if (!selectedFile) {
      setFailure("Unsupported file", "Please upload a file first");
      return;
    }

    if (operation === "convert" && availableTargets.length === 0) {
      setFailure("Unsupported file", "This file type cannot be converted here");
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("operation", operation);
      if (operation === "convert") {
        formData.append("targetFormat", targetFormat);
      }

      const response = await fetch(buildEndpoint("/process"), {
        method: "POST",
        body: formData,
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        // Fallback handled below.
      }

      if (!response.ok || payload.status === "failed") {
        setFailure(
          payload.message || "Processing failed",
          payload.reason || "Unknown error",
        );
        return;
      }

      const downloadUrl = payload.downloadUrl
        ? buildEndpoint(payload.downloadUrl)
        : buildEndpoint(`/download/${payload.downloadId}`);

      setStatus({
        kind: "success",
        message: payload.message || "File processed successfully",
        reason: payload.detectedType
          ? `Detected type: ${payload.detectedType}`
          : "",
        downloadUrl,
        downloadName: payload.downloadName,
      });
    } catch (error) {
      setFailure("Processing failed", error.message || "Network error");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative w-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur-lg sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-coral/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-lagoon/20 blur-3xl" />

        <section className="relative z-10 space-y-6">
          <header className="space-y-3">
            <p className="inline-flex items-center rounded-full bg-foam px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tide">
              FileUnlocker
            </p>
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
              Unlock restrictions, convert formats, and repair documents safely.
            </h1>
            <p className="max-w-3xl text-sm text-ink/75 sm:text-base">
              This toolkit never bypasses strong encryption, passwords, or DRM.
              If a file is securely encrypted, processing stops and asks for the
              original password.
            </p>
          </header>

          <section
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              dragActive
                ? "border-coral bg-coral/10"
                : "border-lagoon/45 bg-white hover:border-lagoon hover:bg-foam/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => onPickFile(event.target.files?.[0])}
            />
            <UploadCloud className="mx-auto h-12 w-12 text-lagoon" />
            <p className="mt-4 font-display text-xl font-semibold text-ink">
              Drag and drop your file, or click to upload
            </p>
            <p className="mt-2 text-sm text-ink/65">
              Supported: PDF, DOCX, PPTX, XLSX, JPG, PNG, ZIP (max 50MB)
            </p>
          </section>

          {selectedFile && (
            <section className="rounded-2xl border border-lagoon/20 bg-white/80 p-4">
              <div className="flex items-start gap-4">
                <FileTypeIcon extension={selectedExtension} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink sm:text-base">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-xs text-ink/70 sm:text-sm">
                    {formatBytes(selectedFile.size)} •{" "}
                    {selectedFile.type || "Unknown MIME"}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/75">
                Mode
              </span>
              <select
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
                className="rounded-xl border border-lagoon/30 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-coral"
              >
                {OPERATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink/65">{operationMeta?.help}</span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/75">
                Target Format
              </span>
              <select
                value={targetFormat}
                onChange={(event) => setTargetFormat(event.target.value)}
                disabled={
                  operation !== "convert" || availableTargets.length === 0
                }
                className="rounded-xl border border-lagoon/30 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-coral disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availableTargets.length === 0 && (
                  <option value="">Not available</option>
                )}
                {availableTargets.map((target) => (
                  <option key={target} value={target}>
                    .{target}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink/65">
                Conversion supports: PDF↔DOCX and Office/Image to PDF.
              </span>
            </label>
          </section>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedFile || isProcessing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-tide/90 disabled:cursor-not-allowed disabled:bg-tide/50"
          >
            {isProcessing ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wrench className="h-5 w-5" />
                Process File
              </>
            )}
          </button>

          {isProcessing && (
            <section className="rounded-2xl border border-lagoon/20 bg-foam/40 p-4">
              <div className="flex items-center gap-3">
                <LoaderCircle className="h-5 w-5 animate-spin text-lagoon" />
                <p className="text-sm text-ink">
                  Running secure processing queue. This can take a moment for
                  large files.
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-lagoon" />
              </div>
            </section>
          )}

          {status && (
            <section
              className={`rounded-2xl border p-4 ${
                status.kind === "success"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-rose-300 bg-rose-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {status.kind === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-rose-600" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    {status.message}
                  </p>
                  {status.reason && (
                    <p className="text-sm text-ink/70">{status.reason}</p>
                  )}
                </div>
              </div>

              {status.kind === "success" && status.downloadUrl && (
                <a
                  href={status.downloadUrl}
                  download={status.downloadName}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  <Download className="h-4 w-4" />
                  Download Processed File
                </a>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-ink/80">
            <p className="flex items-start gap-2 font-medium">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" />
              Security policy: strong encryption, password protection, and DRM
              are never bypassed.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
