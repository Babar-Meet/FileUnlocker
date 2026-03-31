import express from "express";
import cors from "cors";
import filesRouter from "./routes/files.js";
import { ensureRuntimeDirectories, PORT } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { startDownloadCleanupScheduler } from "./services/downloadStore.js";

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "file-unlocker",
  });
});

app.use(filesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

await ensureRuntimeDirectories();
startDownloadCleanupScheduler();

app.listen(PORT, () => {
  console.log(`FileUnlocker API listening on port ${PORT}`);
});
