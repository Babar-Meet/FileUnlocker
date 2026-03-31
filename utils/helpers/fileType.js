import path from "node:path";
import {
  CONVERSION_TARGETS,
  FILE_KIND_BY_EXTENSION,
  GENERIC_ALLOWED_MIMES,
  MIME_BY_EXTENSION,
  OPERATION_MODES,
  SUPPORTED_EXTENSIONS,
} from "../constants.js";

export function getExtension(fileName) {
  return path.extname(fileName || "").toLowerCase();
}

export function normalizeTargetFormat(targetFormat) {
  return (targetFormat || "").trim().toLowerCase().replace(/^\./, "");
}

function isAllowedMime(extension, mimeType) {
  if (!mimeType) {
    return true;
  }

  const normalizedMime = mimeType.toLowerCase();
  return (
    MIME_BY_EXTENSION[extension]?.includes(normalizedMime) ||
    GENERIC_ALLOWED_MIMES.includes(normalizedMime)
  );
}

export function detectFileType(fileName, mimeType) {
  const extension = getExtension(fileName);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return null;
  }

  if (!isAllowedMime(extension, mimeType)) {
    return null;
  }

  return {
    extension,
    kind: FILE_KIND_BY_EXTENSION[extension],
    mimeType,
  };
}

export function isAllowedUpload(fileName, mimeType) {
  return Boolean(detectFileType(fileName, mimeType));
}

export function isValidOperation(operation) {
  return OPERATION_MODES.has((operation || "").toLowerCase());
}

export function isValidConversion(sourceExtension, targetFormat) {
  const normalizedTarget = normalizeTargetFormat(targetFormat);
  return (CONVERSION_TARGETS[sourceExtension] || []).includes(normalizedTarget);
}
