import path from "node:path";
import { randomUUID } from "node:crypto";
import mime from "mime-types";
import fs from "fs-extra";
import { AppError } from "../../../utils/errors.js";
import { processFile } from "../../../utils/processors/router.js";
import { safeRemoveDir, safeUnlink } from "../../../utils/helpers/fs.js";
import { LIBREOFFICE_BIN, OUTPUT_DIR, QPDF_BIN, WORK_DIR } from "../config.js";
import { setDownloadRecord } from "./downloadStore.js";

export async function processUploadedFile(uploadedFile, options = {}) {
  const normalizedInputFiles = (options.inputFiles || []).filter(Boolean);
  const primaryFile = uploadedFile || normalizedInputFiles[0] || null;

  if (!primaryFile) {
    throw new AppError("Unsupported file", "UNSUPPORTED_FILE", 400);
  }

  const downloadId = randomUUID();
  const jobWorkDir = path.join(WORK_DIR, downloadId);

  await fs.ensureDir(jobWorkDir);

  try {
    const processed = await processFile({
      inputPath: primaryFile.path,
      originalName: primaryFile.originalname,
      mimeType: primaryFile.mimetype,
      operation: options.operation,
      targetFormat: options.targetFormat,
      pageRanges: options.pageRanges,
      inputFiles: normalizedInputFiles.map((file) => ({
        path: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
      })),
      outputBasePath: path.join(OUTPUT_DIR, downloadId),
      workDir: jobWorkDir,
      qpdfBin: QPDF_BIN,
      libreOfficeBin: LIBREOFFICE_BIN,
    });

    const baseName =
      options.operation === "merge"
        ? "merged_files"
        : path.parse(primaryFile.originalname).name;
    const downloadName = `${baseName}_processed${processed.outputExtension}`;

    setDownloadRecord(downloadId, {
      filePath: processed.outputPath,
      downloadName,
      mimeType:
        processed.mimeType ||
        mime.lookup(processed.outputExtension) ||
        "application/octet-stream",
    });

    return {
      status: "success",
      message: processed.message,
      downloadId,
      downloadName,
      detectedType: processed.detectedType,
    };
  } finally {
    const cleanupPaths = new Set();
    cleanupPaths.add(primaryFile.path);
    for (const file of normalizedInputFiles) {
      if (file.path) {
        cleanupPaths.add(file.path);
      }
    }

    await Promise.allSettled(
      Array.from(cleanupPaths).map((filePath) => safeUnlink(filePath)),
    );
    await safeRemoveDir(jobWorkDir);
  }
}
