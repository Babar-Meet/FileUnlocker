import fs from "fs-extra";
import JSZip from "jszip";
import mammoth from "mammoth";
import { AppError } from "../errors.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../constants.js";
import { isOleCompoundBuffer, removeDocProps } from "../helpers/office.js";

function parseReason(error) {
  return error?.message || "Unknown Office processing error";
}

function isPasswordRelated(reason) {
  return /(password|encrypted|protection)/i.test(reason || "");
}

async function loadOfficeZip(inputPath) {
  const buffer = await fs.readFile(inputPath);
  if (isOleCompoundBuffer(buffer)) {
    throw new AppError(SECURE_ENCRYPTION_MESSAGE, "PASSWORD_REQUIRED", 400, {
      reason: "Password required",
    });
  }

  try {
    return await JSZip.loadAsync(buffer, { checkCRC32: true });
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
}

async function writeOfficeZip(zip, outputPath) {
  const outputBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  await fs.writeFile(outputPath, outputBuffer);
}

async function validateDocxReadable(inputPath) {
  try {
    await mammoth.extractRawText({ path: inputPath });
  } catch (error) {
    const reason = parseReason(error);
    if (isPasswordRelated(reason)) {
      throw new AppError(SECURE_ENCRYPTION_MESSAGE, "PASSWORD_REQUIRED", 400, {
        reason: "Password required",
      });
    }
  }
}

export async function unlockDocxRestrictions({ inputPath, outputPath }) {
  await validateDocxReadable(inputPath);
  const zip = await loadOfficeZip(inputPath);

  const settingsPath = "word/settings.xml";
  const settingsFile = zip.file(settingsPath);
  if (settingsFile) {
    const settingsXml = await settingsFile.async("string");
    const updatedSettingsXml = settingsXml
      .replace(/<w:documentProtection[^>]*\/>/g, "")
      .replace(/<w:writeProtection[^>]*\/>/g, "");

    zip.file(settingsPath, updatedSettingsXml);
  }

  removeDocProps(zip);
  await writeOfficeZip(zip, outputPath);
}

export async function unlockPptxRestrictions({ inputPath, outputPath }) {
  const zip = await loadOfficeZip(inputPath);

  const presentationPath = "ppt/presentation.xml";
  const presentationFile = zip.file(presentationPath);
  if (presentationFile) {
    const presentationXml = await presentationFile.async("string");
    const updatedPresentationXml = presentationXml
      .replace(/<p:modifyVerifier[^>]*\/>/g, "")
      .replace(/<p:modifyVerifier[\s\S]*?<\/p:modifyVerifier>/g, "")
      .replace(/<p:writeProtection[^>]*\/>/g, "");

    zip.file(presentationPath, updatedPresentationXml);
  }

  removeDocProps(zip);
  await writeOfficeZip(zip, outputPath);
}

export async function normalizeOfficeDocument({ inputPath, outputPath }) {
  const zip = await loadOfficeZip(inputPath);
  removeDocProps(zip);
  await writeOfficeZip(zip, outputPath);
}

export async function repairOfficeDocument({
  inputPath,
  outputPath,
  extension,
}) {
  if (extension === ".docx") {
    await validateDocxReadable(inputPath);
  }

  const zip = await loadOfficeZip(inputPath);
  removeDocProps(zip);
  await writeOfficeZip(zip, outputPath);
}
