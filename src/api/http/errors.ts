export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function mapErrorToHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof Error) {
    if (error.message.includes("not found")) {
      return new HttpError(404, "not_found", error.message);
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("Provider mismatch") ||
      error.message.includes("not eligible") ||
      error.message.includes("not ready") ||
      error.message.includes("requires")
    ) {
      return new HttpError(422, "invalid_request", error.message);
    }

    if (
      error.message.includes("duplicate") ||
      error.message.includes("already exists") ||
      error.message.includes("already")
    ) {
      return new HttpError(409, "conflict", error.message);
    }
  }

  return new HttpError(500, "internal_error", "Internal server error");
}
