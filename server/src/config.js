import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVER_ROOT = path.resolve(__dirname, "..");
export const TMP_ROOT = path.join(SERVER_ROOT, "tmp");
export const UPLOAD_DIR = path.join(TMP_ROOT, "uploads");
export const OUTPUT_DIR = path.join(TMP_ROOT, "outputs");
export const WORK_DIR = path.join(TMP_ROOT, "work");

export const PORT = Number.parseInt(process.env.PORT ?? "5000", 10);
export const QPDF_BIN = process.env.QPDF_BIN || "qpdf";
export const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || "soffice";

export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
export const DOWNLOAD_TTL_MS = 30 * 60 * 1000;

export async function ensureRuntimeDirectories() {
  await Promise.all([
    fs.ensureDir(TMP_ROOT),
    fs.ensureDir(UPLOAD_DIR),
    fs.ensureDir(OUTPUT_DIR),
    fs.ensureDir(WORK_DIR),
  ]);
}
