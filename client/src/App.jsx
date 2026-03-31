import { useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  LockOpen,
  ScanSearch,
  Scissors,
  ShieldAlert,
  Sparkles,
  Split,
  Stamp,
  UploadCloud,
  WandSparkles,
  Wrench,
  XCircle,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const TOOL_ITEMS = [
  {
    value: "auto",
    label: "Smart Auto",
    help: "Detect file type and run safest processing path",
    detail:
      "Auto mode picks the best route per file type and keeps encryption boundaries intact.",
    icon: Sparkles,
    enabled: true,
  },
  {
    value: "unlock",
    label: "Unlock",
    help: "Remove editable/copy/print restrictions",
    detail:
      "Unlock removes restriction-level controls only. Strong encryption and passwords are never bypassed.",
    icon: LockOpen,
    enabled: true,
  },
  {
    value: "convert",
    label: "Convert",
    help: "Convert to many common output formats",
    detail:
      "Convert uses LibreOffice for document conversions and Sharp/pdf-lib for image conversions.",
    icon: WandSparkles,
    enabled: true,
  },
  {
    value: "optimize",
    label: "Optimize",
    help: "Compress and strip metadata",
    detail:
      "Optimize reduces size, normalizes structure, and removes metadata where safe.",
    icon: BadgeCheck,
    enabled: true,
  },
  {
    value: "repair",
    label: "Repair",
    help: "Best-effort structure repair",
    detail:
      "Repair re-saves and normalizes supported files when partial corruption is detected.",
    icon: Wrench,
    enabled: true,
  },
  {
    value: "merge",
    label: "Merge",
    help: "Combine documents",
    detail: "Coming soon.",
    icon: Split,
    enabled: false,
  },
  {
    value: "split",
    label: "Split",
    help: "Split pages/slides",
    detail: "Coming soon.",
    icon: Scissors,
    enabled: false,
  },
  {
    value: "ocr",
    label: "OCR",
    help: "Scan text from images/PDF",
    detail: "Coming soon.",
    icon: ScanSearch,
    enabled: false,
  },
  {
    value: "watermark",
    label: "Watermark",
    help: "Apply watermarks",
    detail: "Coming soon.",
    icon: Stamp,
    enabled: false,
  },
];

const CONVERSION_TARGETS = {
  ".pdf": ["docx", "odt", "rtf", "txt", "html"],
  ".docx": ["pdf", "odt", "rtf", "txt", "html", "doc", "epub"],
  ".pptx": ["pdf", "odp", "ppt", "html", "txt"],
  ".xlsx": ["pdf", "ods", "xls", "csv", "html"],
  ".jpg": ["pdf", "png", "webp", "avif", "tiff"],
  ".jpeg": ["pdf", "png", "webp", "avif", "tiff"],
  ".png": ["pdf", "jpg", "jpeg", "webp", "avif", "tiff"],
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

function StepCard({ index, title, text }) {
  return (
    <div className="rounded-xl border border-lagoon/15 bg-white/75 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lagoon/75">
        Step {index}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink/65">{text}</p>
    </div>
  );
}

function HomePage() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [operation, setOperation] = useState("auto");
  const [hoveredOperation, setHoveredOperation] = useState("");
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

  const currentTool = useMemo(
    () => TOOL_ITEMS.find((item) => item.value === operation) || TOOL_ITEMS[0],
    [operation],
  );

  const activeHoverTool = useMemo(
    () =>
      TOOL_ITEMS.find((item) => item.value === hoveredOperation) || currentTool,
    [hoveredOperation, currentTool],
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
    if (nextTargets.length === 0) {
      setTargetFormat("");
      return;
    }

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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="relative w-full overflow-hidden rounded-3xl border border-white/60 bg-white/75 shadow-panel backdrop-blur-lg">
        <div className="pointer-events-none absolute -left-16 -top-20 h-72 w-72 rounded-full bg-lagoon/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-coral/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-tide/10 blur-3xl" />

        <header className="relative z-10 border-b border-lagoon/15 bg-gradient-to-r from-tide via-tide to-lagoon px-4 py-4 text-white sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                FileUnlocker
              </p>
              <h1 className="mt-1 font-display text-xl font-bold sm:text-2xl">
                Premium File Studio
              </h1>
            </div>
            <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              Restriction Unlock • Conversion • Repair • Optimize
            </p>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <nav className="flex min-w-max items-center gap-2">
              {TOOL_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = operation === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={!item.enabled}
                    onClick={() => item.enabled && setOperation(item.value)}
                    onMouseEnter={() => setHoveredOperation(item.value)}
                    onMouseLeave={() => setHoveredOperation("")}
                    onFocus={() => setHoveredOperation(item.value)}
                    onBlur={() => setHoveredOperation("")}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      item.enabled
                        ? isActive
                          ? "border-white bg-white text-tide"
                          : "border-white/30 bg-white/10 text-white hover:border-white/70 hover:bg-white/20"
                        : "cursor-not-allowed border-white/20 bg-white/5 text-white/45"
                    }`}
                    title={item.help}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <section className="relative z-10 grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-lagoon/20 bg-white/85 p-4">
              <h2 className="font-display text-lg font-bold text-ink sm:text-xl">
                {currentTool.label}
              </h2>
              <p className="mt-1 text-sm text-ink/70">{currentTool.help}</p>

              <div className="mt-3 rounded-xl border border-lagoon/15 bg-foam/40 p-3 text-sm text-ink/80">
                <p className="font-semibold text-ink">Tool details</p>
                <p className="mt-1">{activeHoverTool.detail}</p>
                <p className="mt-2 text-xs text-ink/65">
                  Security boundary: strong password encryption and DRM are
                  never bypassed.
                </p>
              </div>
            </div>

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
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-lagoon/20 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                Process Flow
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <StepCard
                  index="01"
                  title="Choose a tool"
                  text="Use the top navbar to pick unlock, convert, optimize, or repair."
                />
                <StepCard
                  index="02"
                  title="Upload file"
                  text="Drop your file or click the upload zone."
                />
                <StepCard
                  index="03"
                  title="Process"
                  text="Run secure processing queue with transparent status."
                />
                <StepCard
                  index="04"
                  title="Download"
                  text="Get the processed result with one click."
                />
              </div>
            </section>

            {operation === "convert" && (
              <section className="rounded-2xl border border-lagoon/20 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                  Convert Target
                </p>
                <select
                  value={targetFormat}
                  onChange={(event) => setTargetFormat(event.target.value)}
                  disabled={availableTargets.length === 0}
                  className="mt-2 w-full rounded-xl border border-lagoon/30 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-coral disabled:cursor-not-allowed disabled:opacity-60"
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
                <p className="mt-2 text-xs text-ink/65">
                  Available targets are based on file type and processor
                  capability.
                </p>
              </section>
            )}

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
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
