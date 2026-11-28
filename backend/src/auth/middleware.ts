import { timingSafeEqual } from "node:crypto";
import type { RequestHandler, Request } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import type { Environment } from "../config/environment.js";
import { ApiError } from "../http/errors.js";
import { type AuthService, type CurrentUser } from "./service.js";

export function bearer(request: Request): string | undefined {
  const value = request.get("Authorization");
  if (!value) return undefined;
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(value)) throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
  return value.slice(7);
}

export function trustedTransport(config: Pick<Environment, "appOrigin" | "bffSharedSecret">): RequestHandler {
  return (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Vary", "Cookie");
    const supplied = Buffer.from(request.get("X-BFF-Key") ?? "");
    const expected = Buffer.from(config.bffSharedSecret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ApiError(403, "FORBIDDEN", "Trusted server transport is required.");
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (request.get("Origin") !== config.appOrigin || request.get("X-Prime-Haven-CSRF") !== "1") throw new ApiError(403, "CSRF_REJECTED", "Request origin could not be verified.");
      const imageUpload = request.method === "PUT" && /^\/properties\/[0-9a-f-]{36}\/uploads\/[0-9a-f-]{36}\/content$/i.test(request.path);
      if (imageUpload && request.get("Content-Encoding") && request.get("Content-Encoding") !== "identity") throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Compressed image requests are not supported.");
      if (imageUpload ? !["image/jpeg", "image/png", "image/webp"].some(type => request.is(type)) : !request.is("application/json")) {
        throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", imageUpload ? "Use JPEG, PNG or WebP image bytes." : "Use application/json.");
      }
    }
    next();
  };
}

type AuthenticatedRequest = Request & { authenticatedUser?: CurrentUser };
export function requireAuthentication(service: AuthService): RequestHandler {
  return async (request: AuthenticatedRequest, _response, next) => {
    request.authenticatedUser = await service.authenticate(bearer(request));
    next();
  };
}

export function currentUser(request: Request): CurrentUser {
  const user = (request as AuthenticatedRequest).authenticatedUser;
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
  return user;
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!roles.includes(currentUser(request).role)) throw new ApiError(403, "FORBIDDEN", "This role cannot perform the operation.");
    next();
  };
}

// Coarse per-process protection uses actual socket address, not caller X-Forwarded-For.
// BFF callers share a bucket. PostgreSQL account lockout is persistent/cross-instance.
export function loginRateLimit(limit = 30, windowMs = 60_000): RequestHandler {
  const buckets = new Map<string, { count: number; until: number }>();
  return (request, response, next) => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
    const key = request.socket.remoteAddress ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 1000) {
        response.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
        throw new ApiError(429, "RATE_LIMITED", "Too many requests.");
      }
      bucket = { count: 0, until: now + windowMs }; buckets.set(key, bucket);
    }
    if (++bucket.count > limit) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.until - now) / 1000))));
      throw new ApiError(429, "RATE_LIMITED", "Too many requests.");
    }
    next();
  };
}
