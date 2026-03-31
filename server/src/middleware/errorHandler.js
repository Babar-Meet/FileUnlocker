import multer from "multer";
import { AppError } from "../../../utils/errors.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../../../utils/constants.js";

const MESSAGE_BY_CODE = {
  PASSWORD_REQUIRED: "Password required",
  UNSUPPORTED_FILE: "Unsupported file",
  FILE_CORRUPTED: "File corrupted",
  PROCESSING_FAILED: "Processing failed",
  FILE_TOO_LARGE: "Processing failed",
};

export function notFoundHandler(_req, _res, next) {
  next(new AppError("Processing failed", "PROCESSING_FAILED", 404));
}

export function errorHandler(err, _req, res, _next) {
  let normalizedError = err;

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    normalizedError = new AppError("File exceeds 50MB", "FILE_TOO_LARGE", 400, {
      reason: "Max file size is 50MB",
    });
  }

  if (!(normalizedError instanceof AppError)) {
    normalizedError = new AppError(
      normalizedError?.message || "Processing failed",
      normalizedError?.code || "PROCESSING_FAILED",
      normalizedError?.statusCode || 500,
    );
  }

  const message =
    normalizedError.code === "PASSWORD_REQUIRED" &&
    normalizedError.message === SECURE_ENCRYPTION_MESSAGE
      ? SECURE_ENCRYPTION_MESSAGE
      : MESSAGE_BY_CODE[normalizedError.code] || "Processing failed";

  res.status(normalizedError.statusCode).json({
    status: "failed",
    message,
    reason: normalizedError.details?.reason || normalizedError.message,
    code: normalizedError.code,
  });
}
