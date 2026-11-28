import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { boundedBody, configuration, failure, NO_STORE } from "./auth";

type Operation = "list" | "create" | "read" | "edit" | "duplicate";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const contentKeys = ["title","description","purpose","propertyType","priceNaira","negotiable","state","city","neighbourhood","exactAddress","showExactAddress","rentPeriod","bedrooms","bathrooms","toilets","furnishing","parkingSpaces","floorAreaSqm","plotSizeSqm","titleDocumentType"];
const scalarKeys = ["id","ownerId","reference","version","etag","status","slug","publishedAt","submittedAt","archivedAt","rejectionReason","verified","verifiedById","verifiedAt","featured","featuredAt","viewCount","createdAt","updatedAt"];

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function project(value: unknown) {
  if (!object(value) || typeof value.id !== "string" || !uuid.test(value.id) || value.status !== "DRAFT" || !object(value.content) ||
    !Array.isArray(value.amenityIds) || !value.amenityIds.every(id => typeof id === "string" && uuid.test(id)) ||
    !Array.isArray(value.amenities) || !Array.isArray(value.missingRequirements) ||
    !Array.isArray(value.gallery) || value.gallery.length !== 0) return null;
  const scalars = Object.fromEntries(scalarKeys.map(key => [key, value[key]]));
  if (Object.values(scalars).some(item => item !== null && !["string","number","boolean"].includes(typeof item))) return null;
  const content = Object.fromEntries(contentKeys.map(key => [key, (value.content as Record<string, unknown>)[key]]));
  if (Object.values(content).some(item => item !== null && !["string","number","boolean"].includes(typeof item))) return null;
  const amenities = value.amenities.map(item => object(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.isActive === "boolean"
    ? { id: item.id, name: item.name, isActive: item.isActive } : null);
  const missingRequirements = value.missingRequirements.map(item => object(item) && ["path","code","message"].every(key => typeof item[key] === "string")
    ? { path: item.path, code: item.code, message: item.message } : null);
  if (amenities.includes(null) || missingRequirements.includes(null)) return null;
  return { ...scalars, content, gallery: [], amenityIds: value.amenityIds, amenities, missingRequirements };
}

export async function handleProperties(request: NextRequest, operation: Operation, id?: string) {
  let config: ReturnType<typeof configuration>;
  try { config = configuration(); } catch { return failure(503, "SERVICE_UNAVAILABLE", "Server transport is not configured."); }
  const mutate = ["create","edit","duplicate"].includes(operation);
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if ((origin && origin !== config.origin) || (site && !["same-origin","none"].includes(site)) ||
    (mutate && (origin !== config.origin || request.headers.get("x-prime-haven-csrf") !== "1"))) return failure(403, "CSRF_REJECTED", "Request origin could not be verified.");
  if (id !== undefined && !uuid.test(id)) return failure(400, "INVALID_REQUEST", "Invalid property identifier.");
  const query = request.nextUrl.searchParams;
  if (operation !== "list" && request.nextUrl.search) return failure(400, "INVALID_REQUEST", "Query parameters are not supported.");
  const allowed = ["page","pageSize","status","rejectedOnly","sort"];
  for (const key of query.keys()) if (!allowed.includes(key) || query.getAll(key).length !== 1) return failure(400, "INVALID_REQUEST", "Invalid query parameters.");
  if (mutate && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  const occurrences = (request.headers.get("cookie") ?? "").split(";").filter(part => part.trim().split("=",1)[0] === config.cookie).length;
  if (occurrences > 1) return failure(400, "INVALID_REQUEST", "Ambiguous session cookie.");
  const token = request.cookies.get(config.cookie)?.value;
  const headers = new Headers({ "X-BFF-Key": config.key });
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) headers.set("Authorization", `Bearer ${token}`);
  const ifMatch = request.headers.get("if-match");
  if (operation === "edit" && ifMatch) headers.set("If-Match", ifMatch);
  let body: string | undefined;
  try { if (mutate) body = await boundedBody(request, 32768); }
  catch (error) { return failure(error instanceof RangeError ? 413 : 400, error instanceof RangeError ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST", "Invalid request body."); }
  if (mutate) {
    headers.set("Origin", config.origin); headers.set("X-Prime-Haven-CSRF", "1"); headers.set("Content-Type", "application/json");
  }
  const path = "/api/v1/agent/properties" + (id ? `/${id}` : "") + (operation === "duplicate" ? "/duplicates" : "") +
    (operation === "list" && query.size ? `?${query.toString()}` : "");
  let upstream: Response;
  try {
    upstream = await fetch(config.api + path, { method: operation === "edit" ? "PATCH" : mutate ? "POST" : "GET",
      headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch { return failure(502, "UPSTREAM_ERROR", "Property service is unavailable."); }
  const json: unknown = await upstream.json().catch(() => null);
  if (!object(json)) return failure(502, "UPSTREAM_ERROR", "Invalid property response.");
  if (!upstream.ok) {
    if (!object(json.error)) return failure(502, "UPSTREAM_ERROR", "Invalid property response.");
    const response = NextResponse.json({ error: json.error }, { status: upstream.status, headers: NO_STORE });
    if (upstream.status === 401) response.cookies.set(config.cookie, "", { httpOnly: true, secure: config.secure, sameSite: "strict", path: "/", expires: new Date(0), maxAge: 0 });
    return response;
  }
  if (upstream.status !== (["create","duplicate"].includes(operation) ? 201 : 200)) return failure(502, "UPSTREAM_ERROR", "Invalid property response.");
  let payload;
  if (operation === "list") {
    if (!Array.isArray(json.data) || !object(json.pagination)) return failure(502, "UPSTREAM_ERROR", "Invalid property response.");
    const data = json.data.map(project);
    const pagination = Object.fromEntries(["page","pageSize","total","totalPages"].map(key => [key, (json.pagination as Record<string, unknown>)[key]]));
    if (data.includes(null) || Object.values(pagination).some(value => typeof value !== "number" || !Number.isSafeInteger(value))) return failure(502, "UPSTREAM_ERROR", "Invalid property response.");
    payload = { data, pagination };
  } else {
    const data = project(json.data);
    if (!data) return failure(502, "UPSTREAM_ERROR", "Invalid property response.");
    payload = { data };
  }
  const response = NextResponse.json(payload, { status: upstream.status, headers: NO_STORE });
  if (operation !== "list") {
    const etag = upstream.headers.get("etag");
    if (etag) response.headers.set("ETag", etag);
    if (upstream.status === 201 && object(json.data)) response.headers.set("Location", `/api/v1/agent/properties/${json.data.id}`);
  }
  return response;
}
