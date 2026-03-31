import fs from "fs-extra";
import JSZip from "jszip";
import mammoth from "mammoth";
import { AppError } from "../errors.js";
import { SECURE_ENCRYPTION_MESSAGE } from "../constants.js";
import {
  isOleCompoundBuffer,
  removeDocProps,
  validateOfficePackage,
} from "../helpers/office.js";

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

async function writeOfficeZip(zip, outputPath, extension) {
  try {
    await validateOfficePackage(zip, extension);
  } catch (error) {
    throw new AppError("File corrupted", "FILE_CORRUPTED", 400, {
      reason: parseReason(error),
    });
  }

  try {
    const outputBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });
    await fs.writeFile(outputPath, outputBuffer);
  } catch (error) {
    throw new AppError("Processing failed", "PROCESSING_FAILED", 500, {
      reason: parseReason(error),
    });
  }
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
      .replace(/<w:documentProtection[\s\S]*?<\/w:documentProtection>/g, "")
      .replace(/<w:writeProtection[^>]*\/>/g, "")
      .replace(/<w:writeProtection[\s\S]*?<\/w:writeProtection>/g, "");

    zip.file(settingsPath, updatedSettingsXml);
  }

  await removeDocProps(zip);
  await writeOfficeZip(zip, outputPath, ".docx");
}

export async function unlockPptxRestrictions({ inputPath, outputPath }) {
  const zip = await loadOfficeZip(inputPath);

  const pptXmlFiles = zip.file(/^ppt\/.*\.xml$/);

  for (const pptXmlFile of pptXmlFiles) {
    const xml = await pptXmlFile.async("string");
    const updatedXml = xml
      .replace(/<p:modifyVerifier[^>]*\/>/g, "")
      .replace(/<p:modifyVerifier[\s\S]*?<\/p:modifyVerifier>/g, "")
      .replace(/<p:writeProtection[^>]*\/>/g, "")
      .replace(/<p:writeProtection[\s\S]*?<\/p:writeProtection>/g, "");

    if (updatedXml !== xml) {
      zip.file(pptXmlFile.name, updatedXml);
    }
  }

  await removeDocProps(zip);
  await writeOfficeZip(zip, outputPath, ".pptx");
}

export async function normalizeOfficeDocument({
  inputPath,
  outputPath,
  extension,
}) {
  const zip = await loadOfficeZip(inputPath);
  await removeDocProps(zip);
  await writeOfficeZip(zip, outputPath, extension);
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
  await removeDocProps(zip);
  await writeOfficeZip(zip, outputPath, extension);
}
