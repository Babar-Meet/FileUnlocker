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

router.post("/process", upload.single("file"), async (req, res, next) => {
  try {
    const operation = (req.body.operation || "auto").toLowerCase();
    const targetFormat = req.body.targetFormat || "";

    const result = await processingQueue.add(() =>
      processUploadedFile(req.file, {
        operation,
        targetFormat,
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
