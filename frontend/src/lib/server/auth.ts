import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type Operation = "sign-in" | "sign-out" | "me";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };

function configuration() {
  const app = new URL(process.env.APP_ORIGIN ?? process.env.SITE_URL ?? "http://localhost:3000");
  const api = new URL(process.env.API_BASE_URL ?? "http://localhost:3001");
  for (const url of [app, api]) {
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.href !== `${url.origin}/` || url.username || url.password ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && process.env.AUTH_ALLOW_LOCAL_HTTP === "true"))) {
      throw new Error("Authentication origins require HTTPS; explicit HTTP loopback is local-only.");
    }
  }
  const key = process.env.BFF_SHARED_SECRET;
  if (!key || !/^[\x21-\x7e]{32,256}$/.test(key)) throw new Error("Authentication transport is not configured.");
  return { origin: app.origin, api: api.origin, key, secure: app.protocol === "https:",
    cookie: app.protocol === "https:" ? "__Host-ph-session" : "ph-session" };
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ error: { status, code, message, fields: [], requestId: randomUUID() } }, { status, headers: NO_STORE });
}

async function boundedBody(request: NextRequest): Promise<string> {
  if (!request.body) return "{}";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new RangeError("Body too large."); }
    chunks.push(part.value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

function safeMe(value: unknown) {
  if (!value || typeof value !== "object" || !("data" in value)) return null;
  const user = value.data;
  if (!user || typeof user !== "object") return null;
  const obj = user as Record<string, unknown>;
  if (!["id", "name", "email", "phone"].every(key => typeof obj[key] === "string") ||
    !["photoUrl", "biography"].every(key => obj[key] === null || typeof obj[key] === "string") ||
    (obj.role !== "AGENT" && obj.role !== "ADMINISTRATOR")) return null;
  return { id: obj.id, name: obj.name, email: obj.email, phone: obj.phone,
    role: obj.role, photoUrl: obj.photoUrl, biography: obj.biography };
}

export async function handleAuth(request: NextRequest, operation: Operation): Promise<NextResponse> {
  let config: ReturnType<typeof configuration>;
  try { config = configuration(); } catch { return failure(503, "SERVICE_UNAVAILABLE", "Authentication is not configured."); }
  const mutate = operation !== "me";
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== config.origin) || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") ||
    (mutate && (origin !== config.origin || request.headers.get("x-prime-haven-csrf") !== "1"))) {
    return failure(403, "CSRF_REJECTED", "Request origin could not be verified.");
  }
  if (request.nextUrl.search) return failure(400, "INVALID_REQUEST", "Query parameters are not supported.");
  if (mutate && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  const cookieOccurrences = (request.headers.get("cookie") ?? "").split(";").filter(part => part.trim().split("=", 1)[0] === config.cookie).length;
  const cookies = request.cookies.getAll(config.cookie);
  if (cookieOccurrences > 1) return failure(400, "INVALID_REQUEST", "Ambiguous session cookie.");
  const candidate = cookies[0]?.value;
  const token = candidate && TOKEN.test(candidate) ? candidate : undefined;
  let body: string | undefined;
  try { if (mutate) body = await boundedBody(request); }
  catch (error) { return error instanceof RangeError ? failure(413, "PAYLOAD_TOO_LARGE", "Request body is too large.") : failure(400, "INVALID_REQUEST", "Invalid request body."); }

  const headers = new Headers({ "X-BFF-Key": config.key });
  // No inbound Authorization, Cookie, forwarding headers or caller-selected URL is relayed.
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (mutate) {
    headers.set("Origin", config.origin);
    headers.set("X-Prime-Haven-CSRF", "1");
    headers.set("Content-Type", "application/json");
  }
  const path = operation === "me" ? "/me" : `/auth/${operation}`;
  let upstream: Response;
  try {
    upstream = await fetch(`${config.api}/api/v1${path}`, { method: mutate ? "POST" : "GET", headers, body,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    return error instanceof Error && error.name === "TimeoutError" ? failure(504, "UPSTREAM_TIMEOUT", "Authentication timed out.") : failure(502, "UPSTREAM_ERROR", "Authentication service is unavailable.");
  }
  let response: NextResponse;
  if (!upstream.ok) {
    const json: unknown = await upstream.json().catch(() => null);
    if (!json || typeof json !== "object" || !("error" in json)) return failure(502, "UPSTREAM_ERROR", "Invalid authentication response.");
    // Express owns the safe error envelope. Only its error body and Retry-After are forwarded.
    response = NextResponse.json({ error: json.error }, { status: upstream.status, headers: NO_STORE });
    const retry = upstream.headers.get("Retry-After");
    if (upstream.status === 429 && retry && /^\d+$/.test(retry)) response.headers.set("Retry-After", retry);
  } else if (operation === "sign-out" && upstream.status === 204) {
    response = new NextResponse(null, { status: 204, headers: NO_STORE });
  } else {
    const user = safeMe(await upstream.json().catch(() => null));
    if (!user || upstream.status !== 200) return failure(502, "UPSTREAM_ERROR", "Invalid authentication response.");
    response = NextResponse.json({ data: user }, { headers: NO_STORE });
    const etag = upstream.headers.get("ETag");
    if (etag) response.headers.set("ETag", etag);
  }
  const cookieOptions = { httpOnly: true, secure: config.secure, sameSite: "strict" as const, path: "/" };
  if (operation === "sign-in" && upstream.ok) {
    const created = upstream.headers.get("X-Session-Token");
    const expires = new Date(upstream.headers.get("X-Session-Expires") ?? "");
    if (!created || !TOKEN.test(created) || !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now() || expires.getTime() > Date.now() + 7 * 86400_000 + 60_000) {
      return failure(502, "UPSTREAM_ERROR", "Invalid authentication response.");
    }
    response.cookies.set(config.cookie, created, { ...cookieOptions, expires });
  }
  if ((operation === "sign-out" && upstream.status === 204) || upstream.status === 401 && operation === "me") {
    response.cookies.set(config.cookie, "", { ...cookieOptions, expires: new Date(0), maxAge: 0 });
  }
  return response;
}
