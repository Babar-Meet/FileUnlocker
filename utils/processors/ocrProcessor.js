import fs from "fs-extra";
import JSZip from "jszip";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";
import { AppError } from "../errors.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../constants.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

function toReason(error) {
  return error?.message || "Unknown OCR error";
}

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(text) {
  return (text || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function ocrImage(inputPath) {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(inputPath);
    return text;
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(inputPath) {
  try {
    const pdfBuffer = await fs.readFile(inputPath);
    const parsed = await pdfParse(pdfBuffer);
    return parsed.text || "";
  } catch (error) {
    const reason = toReason(error);
    if (/(password|encrypted|decrypt)/i.test(reason)) {
      throw new AppError(SECURE_ENCRYPTION_MESSAGE, "PASSWORD_REQUIRED", 400, {
        reason: "Password required",
      });
    }

    throw new AppError("File corrupted", "FILE_CORRUPTED", 400, {
      reason,
    });
  }
}

async function extractDocxText(inputPath) {
  const { value } = await mammoth.extractRawText({ path: inputPath });
  return value || "";
}

async function extractPptxText(inputPath) {
  const fileBuffer = await fs.readFile(inputPath);
  const zip = await JSZip.loadAsync(fileBuffer, { checkCRC32: true });

  const slidePaths = Object.keys(zip.files)
    .filter((filePath) => /^ppt\/slides\/slide\d+\.xml$/i.test(filePath))
    .sort((a, b) => {
      const aNum = Number.parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      const bNum = Number.parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      return aNum - bNum;
    });

  const lines = [];
  for (const slidePath of slidePaths) {
    const slideXml = await zip.file(slidePath)?.async("string");
    if (!slideXml) {
      continue;
    }

    const textMatches = slideXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    for (const match of textMatches) {
      const value = decodeXmlEntities(match[1] || "").trim();
      if (value) {
        lines.push(value);
      }
    }
  }

  return lines.join("\n");
}

async function extractXlsxText(inputPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  const lines = [];
  for (const worksheet of workbook.worksheets) {
    lines.push(`### Sheet: ${worksheet.name}`);
    worksheet.eachRow((row) => {
      const rowValues = row.values
        .slice(1)
        .map((value) => (value == null ? "" : String(value).trim()))
        .filter(Boolean);

      if (rowValues.length > 0) {
        lines.push(rowValues.join("\t"));
      }
    });
    lines.push("");
  }

  return lines.join("\n");
}

export async function runOcrExtraction({ inputPath, extension, outputPath }) {
  try {
    let extractedText = "";

    if ([".jpg", ".jpeg", ".png"].includes(extension)) {
      extractedText = await ocrImage(inputPath);
    } else if (extension === ".pdf") {
      extractedText = await extractPdfText(inputPath);
    } else if (extension === ".docx") {
      extractedText = await extractDocxText(inputPath);
    } else if (extension === ".pptx") {
      extractedText = await extractPptxText(inputPath);
    } else if (extension === ".xlsx") {
      extractedText = await extractXlsxText(inputPath);
    } else {
      throw new AppError("Unsupported file", "UNSUPPORTED_FILE", 400, {
        reason: "OCR supports PDF, DOCX, PPTX, XLSX, JPG, JPEG, and PNG",
      });
    }

    const normalized = normalizeText(extractedText);
    const outputText =
      normalized || "No readable text could be extracted from this file.";
    await fs.writeFile(outputPath, outputText, "utf8");
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Processing failed", "PROCESSING_FAILED", 500, {
      reason: toReason(error),
    });
  }
}
