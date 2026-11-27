import { z } from "zod";
import { ApiError } from "../http/errors.js";

const password = z.string().refine(value => Buffer.byteLength(value, "utf8") <= 72 && !value.includes("\0"), "Password must be at most 72 UTF-8 bytes and contain no NUL.");
export const newPassword = password.refine(value => Array.from(value).length >= 10, "Password must have at least 10 characters.");
export const email = z.string().trim().toLowerCase().max(254).email();
export const loginSchema = z.strictObject({ email, password: password.min(1) });
export const emptySchema = z.strictObject({});
export const bootstrapSchema = z.strictObject({
  name: z.string().trim().min(1).max(120), email,
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/), password: newPassword,
});

export function rejectUnsafeKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) throw new ApiError(400, "INVALID_REQUEST", "Unexpected request field.");
    rejectUnsafeKeys(child);
  }
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  rejectUnsafeKeys(input);
  const result = schema.safeParse(input);
  if (!result.success) {
    const unexpected = result.error.issues.some(issue => issue.code === "unrecognized_keys");
    throw new ApiError(unexpected ? 400 : 422, unexpected ? "INVALID_REQUEST" : "VALIDATION_FAILED", "Check the request fields.",
      result.error.issues.map(issue => ({ path: issue.path.map(String).join("."), code: issue.code.toUpperCase(), message: issue.code === "unrecognized_keys" ? "Unexpected field." : "Invalid value." })));
  }
  return result.data;
}
