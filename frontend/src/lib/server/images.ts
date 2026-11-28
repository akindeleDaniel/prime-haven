import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { boundedBody, configuration, failure, NO_STORE } from "./auth";
import { project } from "./properties";
type Operation = "authorize" | "upload" | "verify" | "gallery";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object"; }
export async function handleImages(request: NextRequest, operation: Operation, id: string, assetId?: string) {
    let config: ReturnType<typeof configuration>;
    try {
        config = configuration();
    }
    catch {
        return failure(503, "SERVICE_UNAVAILABLE", "Server transport is not configured.");
    }
    if (!uuid.test(id) || assetId !== undefined && !uuid.test(assetId) || request.nextUrl.search)
        return failure(400, "INVALID_REQUEST", "Invalid image request.");
    const site = request.headers.get("sec-fetch-site");
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-prime-haven-csrf") !== "1" ||
        site && !["same-origin", "none"].includes(site))
        return failure(403, "CSRF_REJECTED", "Request origin could not be verified.");
    const mime = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (operation === "upload" ? !["image/jpeg", "image/png", "image/webp"].includes(mime) : mime !== "application/json")
        return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported request type.");
    if (request.headers.get("content-encoding") && request.headers.get("content-encoding") !== "identity")
        return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Compressed requests are not supported.");
    const count = (request.headers.get("cookie") ?? "").split(";").filter(part => part.trim().split("=", 1)[0] === config.cookie).length;
    if (count > 1)
        return failure(400, "INVALID_REQUEST", "Ambiguous session cookie.");
    const headers = new Headers({ "X-BFF-Key": config.key, Origin: config.origin, "X-Prime-Haven-CSRF": "1", "Content-Type": mime });
    const token = request.cookies.get(config.cookie)?.value;
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token))
        headers.set("Authorization", `Bearer ${token}`);
    if (operation === "gallery" && request.headers.get("if-match"))
        headers.set("If-Match", request.headers.get("if-match")!);
    if (operation === "upload")
        headers.set("X-Upload-Authorization", request.headers.get("x-upload-authorization") ?? "");
    let body: string | ArrayBuffer;
    try {
        if (operation !== "upload")
            body = await boundedBody(request, 32768);
        else {
            const chunks: Uint8Array[] = [];
            let size = 0;
            const reader = request.body?.getReader();
            if (!reader)
                return failure(400, "INVALID_REQUEST", "Image bytes are required.");
            while (true) {
                const part = await reader.read();
                if (part.done)
                    break;
                size += part.value.length;
                if (size > 5000000) {
                    await reader.cancel();
                    return failure(413, "PAYLOAD_TOO_LARGE", "Image exceeds 5,000,000 bytes.");
                }
                chunks.push(part.value);
            }
            body = new Uint8Array(Buffer.concat(chunks)).buffer;
        }
    }
    catch (error) {
        return failure(error instanceof RangeError ? 413 : 400, "INVALID_REQUEST", "Invalid request body.");
    }
    const base = `/api/v1/properties/${id}`;
    const path = operation === "gallery" ? base + "/images" : base + "/uploads" + (assetId ? `/${assetId}/${operation === "upload" ? "content" : "verification"}` : "");
    let upstream: Response;
    try {
        upstream = await fetch(config.api + path, { method: ["upload", "gallery"].includes(operation) ? "PUT" : "POST", headers, body,
            cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
    }
    catch {
        return failure(502, "UPSTREAM_ERROR", "Image service is unavailable.");
    }
    if (upstream.status === 204 && operation === "upload")
        return new NextResponse(null, { status: 204, headers: NO_STORE });
    const json: unknown = await upstream.json().catch(() => null);
    if (!object(json))
        return failure(502, "UPSTREAM_ERROR", "Invalid image response.");
    if (!upstream.ok) {
        if (!object(json.error))
            return failure(502, "UPSTREAM_ERROR", "Invalid image response.");
        const response = NextResponse.json({ error: json.error }, { status: upstream.status, headers: NO_STORE });
        if (upstream.status === 401)
            response.cookies.set(config.cookie, "", { httpOnly: true, secure: config.secure, sameSite: "strict", path: "/", expires: new Date(0), maxAge: 0 });
        const retry = upstream.headers.get("retry-after");
        if (upstream.status === 429 && retry && /^\d+$/.test(retry))
            response.headers.set("Retry-After", retry);
        return response;
    }
    if (upstream.status !== (operation === "authorize" ? 201 : 200))
        return failure(502, "UPSTREAM_ERROR", "Invalid image response.");
    const data = json.data;
    let safe: unknown;
    if (operation === "gallery") {
        safe = project(data);
        if (!safe)
            return failure(502, "UPSTREAM_ERROR", "Invalid gallery response.");
    }
    else if (operation === "authorize") {
        if (!object(data) || typeof data.assetId !== "string" || !uuid.test(data.assetId) || typeof data.expiresAt !== "string" ||
            !object(data.parameters) || typeof data.parameters.uploadAuthorization !== "string" || !/^[a-f0-9]{64}$/.test(data.parameters.uploadAuthorization))
            return failure(502, "UPSTREAM_ERROR", "Invalid upload authorization.");
        safe = { assetId: data.assetId, uploadUrl: `${base}/uploads/${data.assetId}/content`, expiresAt: data.expiresAt, parameters: { uploadAuthorization: data.parameters.uploadAuthorization } };
    }
    else {
        if (!object(data) || data.state !== "READY" || typeof data.assetId !== "string" || typeof data.url !== "string" ||
            typeof data.width !== "number" || typeof data.height !== "number" || typeof data.byteSize !== "number" || typeof data.mimeType !== "string")
            return failure(502, "UPSTREAM_ERROR", "Invalid image verification response.");
        safe = Object.fromEntries(["assetId", "state", "url", "width", "height", "mimeType", "byteSize"].map(key => [key, data[key]]));
    }
    const response = NextResponse.json({ data: safe }, { status: upstream.status, headers: NO_STORE });
    if (operation === "gallery" && upstream.headers.get("etag"))
        response.headers.set("ETag", upstream.headers.get("etag")!);
    if (operation === "authorize" && object(safe))
        response.headers.set("Location", String(safe.uploadUrl));
    return response;
}
