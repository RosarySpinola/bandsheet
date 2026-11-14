/** API errors always serialise to { error, code? }; never a stack trace or raw upstream body. */
export class AppError extends Error {
  constructor(
    public readonly status: 400 | 401 | 402 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502 | 503,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
  body(): { error: string; code?: string } {
    return this.code ? { error: this.message, code: this.code } : { error: this.message };
  }
}

export class SpendCapError extends AppError {
  detail: string | undefined;
  constructor(detail?: string) {
    super(402, "spend cap reached", "SPEND_CAP");
    this.detail = detail;
  }
}
