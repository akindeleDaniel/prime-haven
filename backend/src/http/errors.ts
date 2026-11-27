import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";

export interface FieldError { path: string; code: string; message: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public fields: FieldError[] = []) { super(message); }
}

export const requestContext: RequestHandler = (_request, response, next) => {
  response.locals.requestId = randomUUID();
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  let safe = error instanceof ApiError ? error : new ApiError(500, "INTERNAL_ERROR", "The request could not be completed.");
  if (error && typeof error === "object" && "type" in error) {
    if (error.type === "entity.parse.failed") safe = new ApiError(400, "INVALID_REQUEST", "Invalid JSON body.");
    if (error.type === "entity.too.large") safe = new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  // Deliberately do not log Error.message/stack: adapter/parser errors may include PII or input.
  if (safe.status >= 500) console.error(JSON.stringify({ event: "request_failed", requestId: response.locals.requestId, code: safe.code }));
  response.status(safe.status).json({ error: {
    status: safe.status, code: safe.code, message: safe.message,
    fields: safe.fields, requestId: response.locals.requestId,
  } });
};
