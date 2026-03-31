import path from "node:path";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { UPLOAD_DIR } from "../config.js";
import { MAX_UPLOAD_SIZE_BYTES } from "../../../utils/constants.js";
import { isAllowedUpload } from "../../../utils/helpers/fileType.js";
import { AppError } from "../../../utils/errors.js";

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    callback(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, callback) {
  if (!isAllowedUpload(file.originalname, file.mimetype)) {
    callback(new AppError("Unsupported file", "UNSUPPORTED_FILE", 400));
    return;
  }

  callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
});

export default upload;
