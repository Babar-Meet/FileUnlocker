import { CLEANUP_INTERVAL_MS, DOWNLOAD_TTL_MS } from "../config.js";
import { safeUnlink } from "../../../utils/helpers/fs.js";

const downloadStore = new Map();
let cleanupTimer = null;

export function setDownloadRecord(downloadId, record) {
  downloadStore.set(downloadId, {
    ...record,
    createdAt: Date.now(),
  });
}

export function getDownloadRecord(downloadId) {
  return downloadStore.get(downloadId);
}

export async function removeDownloadRecord(downloadId) {
  const record = downloadStore.get(downloadId);
  if (!record) {
    return;
  }

  downloadStore.delete(downloadId);
  await safeUnlink(record.filePath);
}

async function sweepExpiredDownloads() {
  const now = Date.now();
  const deletions = [];

  for (const [downloadId, record] of downloadStore.entries()) {
    if (now - record.createdAt > DOWNLOAD_TTL_MS) {
      deletions.push(removeDownloadRecord(downloadId));
    }
  }

  await Promise.allSettled(deletions);
}

export function startDownloadCleanupScheduler() {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    sweepExpiredDownloads().catch(() => {
      // Ignore sweep failures; files are also deleted on download.
    });
  }, CLEANUP_INTERVAL_MS);

  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }
}
