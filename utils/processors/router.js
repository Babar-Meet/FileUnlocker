import path from "node:path";
import fs from "fs-extra";
import mime from "mime-types";
import { AppError } from "../errors.js";
import {
  detectFileType,
  isValidConversion,
  isValidOperation,
  normalizeTargetFormat,
} from "../helpers/fileType.js";
import {
  normalizeOfficeDocument,
  repairOfficeDocument,
  unlockDocxRestrictions,
  unlockPptxRestrictions,
} from "./officeProcessor.js";
import {
  optimizeXlsx,
  repairXlsx,
  unlockXlsxSheetProtection,
} from "./excelProcessor.js";
import {
  convertImageToPdf,
  optimizeImage,
  repairImage,
} from "./imageProcessor.js";
import { normalizeZip, repairZip } from "./zipProcessor.js";
import { convertWithLibreOffice } from "./conversionProcessor.js";
import {
  optimizePdf,
  repairPdf,
  unlockPdfRestrictions,
} from "./pdfProcessor.js";

function createOutputPath(outputBasePath, extension) {
  return `${outputBasePath}${extension}`;
}

function unsupportedFile(
  reason = "This operation is not available for this file type",
) {
  return new AppError("Unsupported file", "UNSUPPORTED_FILE", 400, { reason });
}

async function ensureOutputExists(outputPath) {
  if (!(await fs.pathExists(outputPath))) {
    throw new AppError("Processing failed", "PROCESSING_FAILED", 500, {
      reason: "Processor did not create an output file",
    });
  }
}

async function unlockByType({ fileType, inputPath, outputPath, qpdfBin }) {
  if (fileType.extension === ".pdf") {
    await unlockPdfRestrictions({ inputPath, outputPath, qpdfBin });
    return "Restrictions removed from PDF.";
  }

  if (fileType.extension === ".docx") {
    await unlockDocxRestrictions({ inputPath, outputPath });
    return "Editing restrictions removed from DOCX.";
  }

  if (fileType.extension === ".pptx") {
    await unlockPptxRestrictions({ inputPath, outputPath });
    return "Editing restrictions removed from PPTX.";
  }

  if (fileType.extension === ".xlsx") {
    await unlockXlsxSheetProtection({ inputPath, outputPath });
    return "Sheet protection removed from XLSX where possible.";
  }

  if (fileType.extension === ".zip") {
    await normalizeZip({ inputPath, outputPath });
    return "ZIP extracted and rebuilt successfully.";
  }

  throw unsupportedFile(
    "Unlock is only available for PDF, DOCX, PPTX, XLSX, and ZIP",
  );
}

async function optimizeByType({ fileType, inputPath, outputPath, qpdfBin }) {
  if (fileType.extension === ".pdf") {
    await optimizePdf({ inputPath, outputPath, qpdfBin });
    return "PDF optimized and normalized.";
  }

  if (fileType.kind === "image") {
    await optimizeImage({ inputPath, outputPath });
    return "Image compressed and metadata stripped.";
  }

  if (fileType.extension === ".docx" || fileType.extension === ".pptx") {
    await normalizeOfficeDocument({
      inputPath,
      outputPath,
      extension: fileType.extension,
    });
    return "Office document normalized and metadata removed.";
  }

  if (fileType.extension === ".xlsx") {
    await optimizeXlsx({ inputPath, outputPath });
    return "Spreadsheet normalized and metadata removed.";
  }

  if (fileType.extension === ".zip") {
    await normalizeZip({ inputPath, outputPath });
    return "ZIP normalized for clean structure.";
  }

  throw unsupportedFile("Optimize is not supported for this file type");
}

async function repairByType({ fileType, inputPath, outputPath, qpdfBin }) {
  if (fileType.extension === ".pdf") {
    await repairPdf({ inputPath, outputPath, qpdfBin });
    return "PDF repaired and re-saved.";
  }

  if (fileType.extension === ".docx" || fileType.extension === ".pptx") {
    await repairOfficeDocument({
      inputPath,
      outputPath,
      extension: fileType.extension,
    });
    return "Office file repaired and re-saved.";
  }

  if (fileType.extension === ".xlsx") {
    await repairXlsx({ inputPath, outputPath });
    return "Spreadsheet repaired and re-saved.";
  }

  if (fileType.kind === "image") {
    await repairImage({ inputPath, outputPath });
    return "Image repaired and re-saved.";
  }

  if (fileType.extension === ".zip") {
    await repairZip({ inputPath, outputPath });
    return "ZIP repaired and rebuilt.";
  }

  throw unsupportedFile("Repair is not supported for this file type");
}

async function convertByType({
  fileType,
  inputPath,
  outputPath,
  targetFormat,
  libreOfficeBin,
}) {
  if (!isValidConversion(fileType.extension, targetFormat)) {
    throw unsupportedFile("Unsupported conversion pair for this file type");
  }

  if (fileType.kind === "image" && targetFormat === "pdf") {
    await convertImageToPdf({ inputPath, outputPath });
    return "Image converted to PDF.";
  }

  await convertWithLibreOffice({
    inputPath,
    targetFormat,
    outputPath,
    libreOfficeBin,
  });

  return "File converted successfully.";
}

async function autoByType({
  fileType,
  inputPath,
  outputPath,
  workDir,
  qpdfBin,
}) {
  if (fileType.extension === ".pdf") {
    const unlockedPath = path.join(workDir, "unlocked.pdf");
    await unlockPdfRestrictions({
      inputPath,
      outputPath: unlockedPath,
      qpdfBin,
    });
    await optimizePdf({ inputPath: unlockedPath, outputPath, qpdfBin });
    return "PDF unlocked (restrictions only), optimized, and normalized.";
  }

  if (fileType.extension === ".docx") {
    await unlockDocxRestrictions({ inputPath, outputPath });
    return "DOCX restrictions removed and document normalized.";
  }

  if (fileType.extension === ".pptx") {
    await unlockPptxRestrictions({ inputPath, outputPath });
    return "PPTX restrictions removed and document normalized.";
  }

  if (fileType.extension === ".xlsx") {
    await unlockXlsxSheetProtection({ inputPath, outputPath });
    return "XLSX sheet protection removed and workbook normalized.";
  }

  if (fileType.kind === "image") {
    await optimizeImage({ inputPath, outputPath });
    return "Image optimized and metadata stripped.";
  }

  if (fileType.extension === ".zip") {
    await normalizeZip({ inputPath, outputPath });
    return "ZIP validated and normalized.";
  }

  throw unsupportedFile();
}

export async function processFile({
  inputPath,
  originalName,
  mimeType,
  operation,
  targetFormat,
  outputBasePath,
  workDir,
  qpdfBin,
  libreOfficeBin,
}) {
  const fileType = detectFileType(originalName, mimeType);
  if (!fileType) {
    throw unsupportedFile(
      "Only PDF, DOCX, PPTX, XLSX, JPG, PNG, and ZIP are supported",
    );
  }

  const normalizedOperation = (operation || "auto").toLowerCase();
  if (!isValidOperation(normalizedOperation)) {
    throw unsupportedFile("Unsupported operation mode");
  }

  let outputExtension = fileType.extension;
  let message = "File processed successfully.";
  let outputPath = createOutputPath(outputBasePath, outputExtension);

  if (normalizedOperation === "convert") {
    const normalizedTarget = normalizeTargetFormat(targetFormat);
    if (!normalizedTarget) {
      throw unsupportedFile("A target format is required for convert mode");
    }

    outputExtension = `.${normalizedTarget}`;
    outputPath = createOutputPath(outputBasePath, outputExtension);

    message = await convertByType({
      fileType,
      inputPath,
      outputPath,
      targetFormat: normalizedTarget,
      libreOfficeBin,
    });
  }

  if (normalizedOperation === "unlock") {
    message = await unlockByType({
      fileType,
      inputPath,
      outputPath,
      qpdfBin,
    });
  }

  if (normalizedOperation === "optimize") {
    message = await optimizeByType({
      fileType,
      inputPath,
      outputPath,
      qpdfBin,
    });
  }

  if (normalizedOperation === "repair") {
    message = await repairByType({
      fileType,
      inputPath,
      outputPath,
      qpdfBin,
    });
  }

  if (normalizedOperation === "auto") {
    message = await autoByType({
      fileType,
      inputPath,
      outputPath,
      workDir,
      qpdfBin,
    });
  }

  await ensureOutputExists(outputPath);

  return {
    outputPath,
    outputExtension,
    message,
    detectedType: fileType.extension.slice(1).toUpperCase(),
    mimeType: mime.lookup(outputExtension) || "application/octet-stream",
  };
}
