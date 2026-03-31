import fs from "fs-extra";
import JSZip from "jszip";
import yauzl from "yauzl";
import { AppError } from "../errors.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../constants.js";

function parseReason(error) {
  return error?.message || "Unknown ZIP processing error";
}

async function zipHasEncryptedEntries(inputPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(inputPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError || new Error("Unable to read ZIP"));
        return;
      }

      let settled = false;

      const finish = (value) => {
        if (settled) {
          return;
        }

        settled = true;
        try {
          zipFile.close();
        } catch {
          // Ignore close errors during scan.
        }
        resolve(value);
      };

      zipFile.on("entry", (entry) => {
        if ((entry.generalPurposeBitFlag & 0x1) === 0x1) {
          finish(true);
          return;
        }

        zipFile.readEntry();
      });

      zipFile.on("end", () => finish(false));
      zipFile.on("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      });

      zipFile.readEntry();
    });
  });
}

async function loadZip(inputPath) {
  try {
    const isEncrypted = await zipHasEncryptedEntries(inputPath);
    if (isEncrypted) {
      throw new AppError(SECURE_ENCRYPTION_MESSAGE, "PASSWORD_REQUIRED", 400, {
        reason: "Password required",
      });
    }

    const buffer = await fs.readFile(inputPath);
    return await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("File corrupted", "FILE_CORRUPTED", 400, {
      reason: parseReason(error),
    });
  }
}

async function writeZip(zip, outputPath) {
  const outputBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  await fs.writeFile(outputPath, outputBuffer);
}

export async function normalizeZip({ inputPath, outputPath }) {
  const zip = await loadZip(inputPath);
  await writeZip(zip, outputPath);
}

export async function repairZip({ inputPath, outputPath }) {
  const zip = await loadZip(inputPath);
  await writeZip(zip, outputPath);
}
