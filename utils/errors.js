export class AppError extends Error {
  constructor(
    message,
    code = "PROCESSING_FAILED",
    statusCode = 500,
    details = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
