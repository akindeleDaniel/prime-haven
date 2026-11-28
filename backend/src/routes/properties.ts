import { Router } from "express";
import { bearer, currentUser, requireAuthentication, requireRoles } from "../auth/middleware.js";
import type { AuthService } from "../auth/service.js";
import { emptySchema, parseInput } from "../auth/validation.js";
import type { PropertyService } from "../properties/service.js";
import { ApiError } from "../http/errors.js";

export function propertyRouter(auth: AuthService, service: PropertyService): Router {
  const router = Router();
  router.use("/agent/properties", requireAuthentication(auth), requireRoles("AGENT"));
  router.get("/agent/properties", async (request, response) => {
    response.json(await service.list(currentUser(request), bearer(request)!, new URL(request.originalUrl, "http://localhost").searchParams));
  });
  router.post("/agent/properties", async (request, response) => {
    if (request.originalUrl.includes("?")) throw new ApiError(400, "INVALID_REQUEST", "Query parameters are not supported.");
    const property = await service.create(currentUser(request), bearer(request)!, request.body);
    response.status(201).setHeader("Location", `/api/v1/agent/properties/${property.id}`);
    response.setHeader("ETag", property.etag);
    response.json({ data: property });
  });
  router.use("/agent/properties/:id", (request, _response, next) => {
    if (request.originalUrl.includes("?")) throw new ApiError(400, "INVALID_REQUEST", "Query parameters are not supported.");
    next();
  });
  router.get("/agent/properties/:id", async (request, response) => {
    const property = await service.read(currentUser(request), bearer(request)!, request.params.id);
    response.setHeader("ETag", property.etag);
    response.json({ data: property });
  });
  router.patch("/agent/properties/:id", async (request, response) => {
    const property = await service.edit(currentUser(request), bearer(request)!, request.params.id, request.body, request.get("If-Match"));
    response.setHeader("ETag", property.etag);
    response.json({ data: property });
  });
  router.post("/agent/properties/:id/duplicates", async (request, response) => {
    parseInput(emptySchema, request.body ?? {});
    const property = await service.duplicate(currentUser(request), bearer(request)!, request.params.id);
    response.status(201).setHeader("Location", `/api/v1/agent/properties/${property.id}`);
    response.setHeader("ETag", property.etag);
    response.json({ data: property });
  });
  return router;
}
