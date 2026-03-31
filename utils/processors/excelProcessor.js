import ExcelJS from "exceljs";
import { AppError } from "../errors.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../constants.js";

function parseReason(error) {
  return error?.message || "Unknown XLSX processing error";
}

function isPasswordRelated(reason) {
  return /(password|encrypted|decrypt|protection)/i.test(reason || "");
}

async function loadWorkbook(inputPath) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(inputPath);
  } catch (error) {
    const reason = parseReason(error);
    if (isPasswordRelated(reason)) {
      throw new AppError(SECURE_ENCRYPTION_MESSAGE, "PASSWORD_REQUIRED", 400, {
        reason: "Password required",
      });
    }

    throw new AppError("File corrupted", "FILE_CORRUPTED", 400, {
      reason,
    });
  }

  return workbook;
}

async function writeWorkbook(workbook, outputPath) {
  try {
    await workbook.xlsx.writeFile(outputPath);
  } catch (error) {
    throw new AppError("Processing failed", "PROCESSING_FAILED", 500, {
      reason: parseReason(error),
    });
  }
}

function stripWorkbookMetadata(workbook) {
  workbook.creator = "";
  workbook.lastModifiedBy = "";
  workbook.company = "";
}

export async function unlockXlsxSheetProtection({ inputPath, outputPath }) {
  const workbook = await loadWorkbook(inputPath);

  for (const worksheet of workbook.worksheets) {
    if (worksheet.model?.sheetProtection) {
      delete worksheet.model.sheetProtection;
    }
  }

  stripWorkbookMetadata(workbook);
  await writeWorkbook(workbook, outputPath);
}

export async function optimizeXlsx({ inputPath, outputPath }) {
  const workbook = await loadWorkbook(inputPath);
  stripWorkbookMetadata(workbook);
  await writeWorkbook(workbook, outputPath);
}

export async function repairXlsx({ inputPath, outputPath }) {
  const workbook = await loadWorkbook(inputPath);
  stripWorkbookMetadata(workbook);
  await writeWorkbook(workbook, outputPath);
}
