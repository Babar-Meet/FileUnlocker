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
  if (!uploadedFile) {
    throw new AppError("Unsupported file", "UNSUPPORTED_FILE", 400);
  }

  const downloadId = randomUUID();
  const jobWorkDir = path.join(WORK_DIR, downloadId);

  await fs.ensureDir(jobWorkDir);

  try {
    const processed = await processFile({
      inputPath: uploadedFile.path,
      originalName: uploadedFile.originalname,
      mimeType: uploadedFile.mimetype,
      operation: options.operation,
      targetFormat: options.targetFormat,
      outputBasePath: path.join(OUTPUT_DIR, downloadId),
      workDir: jobWorkDir,
      qpdfBin: QPDF_BIN,
      libreOfficeBin: LIBREOFFICE_BIN,
    });

    const baseName = path.parse(uploadedFile.originalname).name;
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
    await safeUnlink(uploadedFile.path);
    await safeRemoveDir(jobWorkDir);
  }
}
