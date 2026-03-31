import fs from "fs-extra";

export async function safeUnlink(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.remove(filePath);
  } catch {
    // No-op cleanup helper.
  }
}

export async function safeRemoveDir(dirPath) {
  if (!dirPath) {
    return;
  }

  try {
    await fs.remove(dirPath);
  } catch {
    // No-op cleanup helper.
  }
}
