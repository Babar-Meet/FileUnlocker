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
  unlockDocxRestrictions,
  unlockPptxRestrictions,
} from "./officeProcessor.js";
import { unlockXlsxSheetProtection } from "./excelProcessor.js";
import { convertImageToFormat, convertImageToPdf } from "./imageProcessor.js";
import { normalizeZip } from "./zipProcessor.js";
import { convertWithLibreOffice } from "./conversionProcessor.js";
import { unlockPdfRestrictions } from "./pdfProcessor.js";
import { mergePdfFiles, splitPdfByRanges } from "./mergeSplitProcessor.js";
import { runOcrExtraction } from "./ocrProcessor.js";

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
    return "ZIP validated and rebuilt successfully.";
  }

  throw unsupportedFile(
    "Unlock is supported for PDF, DOCX, PPTX, XLSX, and ZIP files",
  );
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

  if (fileType.kind === "image") {
    if (targetFormat === "pdf") {
      await convertImageToPdf({ inputPath, outputPath });
      return "Image converted to PDF.";
    }

    await convertImageToFormat({ inputPath, outputPath, targetFormat });
    return `Image converted to ${targetFormat.toUpperCase()}.`;
  }

  await convertWithLibreOffice({
    inputPath,
    targetFormat,
    outputPath,
    libreOfficeBin,
  });

  return "File converted successfully.";
}

async function mergeByType({ inputFiles, outputPath }) {
  if (!Array.isArray(inputFiles) || inputFiles.length < 2) {
    throw unsupportedFile("Merge requires at least two files");
  }

  const validatedFiles = inputFiles.map((file) => {
    const fileType = detectFileType(file.originalName, file.mimeType);
    if (!fileType) {
      throw unsupportedFile(
        "Merge only supports PDF files that pass MIME and extension checks",
      );
    }

    if (fileType.extension !== ".pdf") {
      throw unsupportedFile("Merge currently supports PDF files only");
    }

    return file;
  });

  await mergePdfFiles({
    inputFiles: validatedFiles.map((file) => ({
      path: file.path,
      originalName: file.originalName,
    })),
    outputPath,
  });

  return "PDF files merged successfully.";
}

async function splitByType({ fileType, inputPath, outputPath, pageRanges }) {
  if (fileType.extension !== ".pdf") {
    throw unsupportedFile("Split currently supports PDF files only");
  }

  await splitPdfByRanges({
    inputPath,
    outputPath,
    pageRanges,
  });

  return "PDF pages split successfully. Download includes a ZIP package.";
}

async function ocrByType({ fileType, inputPath, outputPath }) {
  await runOcrExtraction({
    inputPath,
    extension: fileType.extension,
    outputPath,
  });

  return "OCR/text extraction completed. Download the TXT output.";
}

export async function processFile({
  inputPath,
  originalName,
  mimeType,
  operation,
  targetFormat,
  pageRanges,
  inputFiles = [],
  outputBasePath,
  qpdfBin,
  libreOfficeBin,
}) {
  const normalizedOperation = (operation || "unlock").toLowerCase();
  if (!isValidOperation(normalizedOperation)) {
    throw unsupportedFile("Unsupported operation mode");
  }

  if (normalizedOperation === "merge") {
    const outputExtension = ".pdf";
    const outputPath = createOutputPath(outputBasePath, outputExtension);

    const message = await mergeByType({
      inputFiles,
      outputPath,
    });

    await ensureOutputExists(outputPath);

    return {
      outputPath,
      outputExtension,
      message,
      detectedType: "PDF",
      mimeType: mime.lookup(outputExtension) || "application/octet-stream",
    };
  }

  const fileType = detectFileType(originalName, mimeType);
  if (!fileType) {
    throw unsupportedFile(
      "Only PDF, DOCX, PPTX, XLSX, JPG, PNG, and ZIP are supported",
    );
  }

  let outputExtension = fileType.extension;
  let outputPath = createOutputPath(outputBasePath, outputExtension);
  let message = "File processed successfully.";

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

  if (normalizedOperation === "split") {
    outputExtension = ".zip";
    outputPath = createOutputPath(outputBasePath, outputExtension);

    message = await splitByType({
      fileType,
      inputPath,
      outputPath,
      pageRanges,
    });
  }

  if (normalizedOperation === "ocr") {
    outputExtension = ".txt";
    outputPath = createOutputPath(outputBasePath, outputExtension);

    message = await ocrByType({
      fileType,
      inputPath,
      outputPath,
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
