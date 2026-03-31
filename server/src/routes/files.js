import express from "express";
import upload from "../middleware/upload.js";
import { AsyncTaskQueue } from "../services/asyncQueue.js";
import { processUploadedFile } from "../services/processService.js";
import {
  getDownloadRecord,
  removeDownloadRecord,
} from "../services/downloadStore.js";
import { AppError } from "../../../utils/errors.js";

const router = express.Router();
const processingQueue = new AsyncTaskQueue(2);

const processUploadMiddleware = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: 30 },
]);

router.post("/process", processUploadMiddleware, async (req, res, next) => {
  try {
    const operation = (req.body.operation || "unlock").toLowerCase();
    const targetFormat = req.body.targetFormat || "";
    const pageRanges = req.body.pageRanges || "";

    const groupedFiles = req.files || {};
    const primaryFile = groupedFiles.file?.[0] || groupedFiles.files?.[0] || null;
    const inputFiles = [
      ...(groupedFiles.file || []),
      ...(groupedFiles.files || []),
    ];

    const result = await processingQueue.add(() =>
      processUploadedFile(primaryFile, {
        operation,
        targetFormat,
        pageRanges,
        inputFiles,
      }),
    );

    res.status(200).json({
      ...result,
      downloadUrl: `/download/${result.downloadId}`,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/download/:id", async (req, res, next) => {
  try {
    const record = getDownloadRecord(req.params.id);
    if (!record) {
      throw new AppError("Processing failed", "PROCESSING_FAILED", 404, {
        reason: "Download not found or expired",
      });
    }

    res.setHeader("Content-Type", record.mimeType);
    res.download(record.filePath, record.downloadName, async (error) => {
      await removeDownloadRecord(req.params.id);

      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
