import { useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
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
  Split,
  UploadCloud,
  WandSparkles,
  XCircle,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const TOOL_ITEMS = [
  {
    value: "unlock",
    label: "Unlock",
    help: "Remove restriction-based protections only",
    detail:
      "Unlock removes edit/print/copy restrictions where supported. Strong encryption and passwords are never bypassed.",
    icon: LockOpen,
  },
  {
    value: "convert",
    label: "Convert",
    help: "Convert file formats with broad target support",
    detail:
      "Convert supports Office/PDF conversions through LibreOffice plus image format conversions through Sharp.",
    icon: WandSparkles,
  },
  {
    value: "merge",
    label: "Merge",
    help: "Merge multiple PDFs into one file",
    detail:
      "Merge combines at least two PDFs into one output file. This operation is PDF-only.",
    icon: Split,
  },
  {
    value: "split",
    label: "Split",
    help: "Split one PDF by page ranges",
    detail:
      "Split exports selected page ranges as separate PDFs and returns a ZIP package.",
    icon: Scissors,
  },
  {
    value: "ocr",
    label: "OCR",
    help: "Extract readable text into TXT",
    detail:
      "OCR extracts text content from supported files and returns a TXT result for quick copy and review.",
    icon: ScanSearch,
  },
];

const CONVERSION_TARGETS = {
  ".pdf": ["docx", "pptx", "xlsx", "odt", "rtf", "txt", "html"],
  ".docx": ["pdf", "odt", "rtf", "txt", "html", "doc", "epub", "pptx"],
  ".pptx": ["pdf", "docx", "odp", "ppt", "html", "txt"],
  ".xlsx": ["pdf", "ods", "xls", "csv", "html", "txt"],
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

function HomePage() {
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [operation, setOperation] = useState("unlock");
  const [hoveredOperation, setHoveredOperation] = useState("");
  const [targetFormat, setTargetFormat] = useState("");
  const [pageRanges, setPageRanges] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState(null);

  const primaryFile = selectedFiles[0] || null;
  const primaryExtension = useMemo(
    () => (primaryFile ? getExtension(primaryFile.name) : ""),
    [primaryFile],
  );

  const availableTargets = useMemo(
    () => CONVERSION_TARGETS[primaryExtension] || [],
    [primaryExtension],
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

  function onPickFiles(fileList) {
    const incomingFiles = Array.from(fileList || []);
    if (incomingFiles.length === 0) {
      return;
    }

    for (const file of incomingFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFailure("Processing failed", "Each file must be 50MB or less");
        return;
      }
    }

    const normalizedFiles =
      operation === "merge" ? incomingFiles : incomingFiles.slice(0, 1);

    setSelectedFiles(normalizedFiles);
    setStatus(null);

    const firstExtension = getExtension(normalizedFiles[0].name);
    const nextTargets = CONVERSION_TARGETS[firstExtension] || [];
    setTargetFormat(nextTargets[0] || "");
  }

  function onDrop(event) {
    event.preventDefault();
    setDragActive(false);
    onPickFiles(event.dataTransfer.files);
  }

  function onOperationChange(nextOperation) {
    setOperation(nextOperation);
    setStatus(null);

    if (nextOperation !== "merge" && selectedFiles.length > 1) {
      const firstFile = selectedFiles[0];
      setSelectedFiles([firstFile]);
      const nextTargets =
        CONVERSION_TARGETS[getExtension(firstFile.name)] || [];
      setTargetFormat(nextTargets[0] || "");
    }
  }

  async function handleSubmit() {
    if (selectedFiles.length === 0) {
      setFailure("Unsupported file", "Please upload a file first");
      return;
    }

    if (operation === "merge") {
      if (selectedFiles.length < 2) {
        setFailure("Unsupported file", "Merge requires at least two PDF files");
        return;
      }

      const allPdf = selectedFiles.every(
        (file) => getExtension(file.name) === ".pdf",
      );
      if (!allPdf) {
        setFailure("Unsupported file", "Merge supports PDF files only");
        return;
      }
    }

    if (operation === "split" && primaryExtension !== ".pdf") {
      setFailure("Unsupported file", "Split supports PDF files only");
      return;
    }

    if (operation === "convert" && availableTargets.length === 0) {
      setFailure(
        "Unsupported file",
        "No conversion target available for this file",
      );
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append("operation", operation);

      if (operation === "convert") {
        formData.append("targetFormat", targetFormat);
      }

      if (operation === "split" && pageRanges.trim()) {
        formData.append("pageRanges", pageRanges.trim());
      }

      if (operation === "merge") {
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });
      } else {
        formData.append("file", selectedFiles[0]);
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

        <header className="relative z-10 border-b border-lagoon/15 bg-gradient-to-r from-tide via-tide to-lagoon px-4 py-4 text-white sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                FileUnlocker
              </p>
              <h1 className="mt-1 font-display text-xl font-bold sm:text-2xl">
                Document Toolkit
              </h1>
            </div>
            <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              Unlock • Convert • Merge • Split • OCR
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
                    onClick={() => onOperationChange(item.value)}
                    onMouseEnter={() => setHoveredOperation(item.value)}
                    onMouseLeave={() => setHoveredOperation("")}
                    onFocus={() => setHoveredOperation(item.value)}
                    onBlur={() => setHoveredOperation("")}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-white bg-white text-tide"
                        : "border-white/30 bg-white/10 text-white hover:border-white/70 hover:bg-white/20"
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
                multiple={operation === "merge"}
                className="hidden"
                onChange={(event) => onPickFiles(event.target.files)}
              />
              <UploadCloud className="mx-auto h-12 w-12 text-lagoon" />
              <p className="mt-4 font-display text-xl font-semibold text-ink">
                {operation === "merge"
                  ? "Drop multiple PDF files, or click to select"
                  : "Drag and drop your file, or click to upload"}
              </p>
              <p className="mt-2 text-sm text-ink/65">
                Supported: PDF, DOCX, PPTX, XLSX, JPG, PNG, ZIP (max 50MB each)
              </p>
            </section>

            {selectedFiles.length > 0 && (
              <section className="rounded-2xl border border-lagoon/20 bg-white/80 p-4">
                <div className="space-y-3">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-start gap-3"
                    >
                      <FileTypeIcon extension={getExtension(file.name)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink sm:text-base">
                          {file.name}
                        </p>
                        <p className="mt-1 text-xs text-ink/70 sm:text-sm">
                          {formatBytes(file.size)} •{" "}
                          {file.type || "Unknown MIME"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
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
                  Includes PDF to Word, PPT to Word, and other common office
                  conversions.
                </p>
              </section>
            )}

            {operation === "split" && (
              <section className="rounded-2xl border border-lagoon/20 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                  Split Page Ranges
                </p>
                <input
                  type="text"
                  value={pageRanges}
                  onChange={(event) => setPageRanges(event.target.value)}
                  placeholder="Example: 1-3,5,7-10"
                  className="mt-2 w-full rounded-xl border border-lagoon/30 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-coral"
                />
                <p className="mt-2 text-xs text-ink/65">
                  Leave empty to split all pages individually.
                </p>
              </section>
            )}

            {operation === "merge" && (
              <section className="rounded-2xl border border-lagoon/20 bg-white/85 p-4">
                <p className="text-sm text-ink/80">
                  Merge requires at least two PDF files and returns one merged
                  PDF.
                </p>
              </section>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-tide/90 disabled:cursor-not-allowed disabled:bg-tide/50"
            >
              {isProcessing ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <WandSparkles className="h-5 w-5" />
                  Process File
                </>
              )}
            </button>

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
