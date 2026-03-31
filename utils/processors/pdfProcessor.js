import fs from "fs-extra";
import { AppError } from "../errors.js";
import { runCommand } from "../helpers/command.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../constants.js";

function isPdfPasswordError(rawText) {
  return /(password|required|invalid password|encrypted)/i.test(rawText || "");
}

function toReason(error) {
  return [error?.stderr, error?.stdout, error?.message]
    .filter(Boolean)
    .join(" ");
}

export async function unlockPdfRestrictions({
  inputPath,
  outputPath,
  qpdfBin,
}) {
  try {
    await runCommand(qpdfBin, ["--decrypt", inputPath, outputPath], {
      timeoutMs: 120000,
    });
  } catch (error) {
    const reason = toReason(error);
    if (/file is not encrypted/i.test(reason)) {
      await fs.copy(inputPath, outputPath, { overwrite: true });
      return;
    }

    if (isPdfPasswordError(reason)) {
      throw new AppError(SECURE_ENCRYPTION_MESSAGE, "PASSWORD_REQUIRED", 400, {
        reason: "Password required",
      });
    }

    throw new AppError("Processing failed", "PROCESSING_FAILED", 500, {
      reason: reason || "qpdf failed while removing restrictions",
    });
  }
}

export async function optimizePdf({ inputPath, outputPath, qpdfBin }) {
  try {
    await runCommand(
      qpdfBin,
      [
        "--linearize",
        "--object-streams=generate",
        "--stream-data=compress",
        inputPath,
        outputPath,
      ],
      { timeoutMs: 120000 },
    );
  } catch (error) {
    throw new AppError("Processing failed", "PROCESSING_FAILED", 500, {
      reason: toReason(error) || "qpdf failed while optimizing PDF",
    });
  }
}

export async function repairPdf({ inputPath, outputPath, qpdfBin }) {
  try {
    await runCommand(qpdfBin, ["--linearize", inputPath, outputPath], {
      timeoutMs: 120000,
    });
  } catch (error) {
    throw new AppError("File corrupted", "FILE_CORRUPTED", 400, {
      reason: toReason(error) || "qpdf could not repair this PDF",
    });
  }
}
