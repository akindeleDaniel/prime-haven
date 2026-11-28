import { Router, raw } from "express";
import { bearer, currentUser, requireAuthentication, requireRoles, loginRateLimit } from "../auth/middleware.js";
import type { AuthService } from "../auth/service.js";
import type { ImageService } from "../images/service.js";
import { emptySchema, parseInput } from "../auth/validation.js";
import { ApiError } from "../http/errors.js";
import { MAX_IMAGE_BYTES, mimes } from "../images/validation.js";
export function imageRouter(auth: AuthService, images: ImageService) {
  const router = Router();
  router.use("/properties", requireAuthentication(auth), requireRoles("AGENT", "ADMINISTRATOR"), (request, _response, next) => {
    if (request.originalUrl.includes("?")) throw new ApiError(400, "INVALID_REQUEST", "Query parameters are not supported.");
    next();
  });
  router.post("/properties/:id/uploads", loginRateLimit(30), async (request, response) => {
    const data = await images.authorize(currentUser(request), bearer(request)!, request.params.id, request.body);
    response.status(201).setHeader("Location", data.uploadUrl);
    response.json({ data });
  });
  router.put("/properties/:id/uploads/:assetId/content", loginRateLimit(30),
    raw({ type: [...mimes], limit: MAX_IMAGE_BYTES, inflate: false }), async (request, response) => {
      if (!Buffer.isBuffer(request.body)) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send image bytes.");
      await images.upload(currentUser(request), bearer(request)!, request.params.id, request.params.assetId,
        request.get("X-Upload-Authorization") ?? "", request.body, request.get("Content-Type")?.split(";")[0] ?? "");
      response.status(204).end();
    });
  router.post("/properties/:id/uploads/:assetId/verification", loginRateLimit(30), async (request, response) => {
    parseInput(emptySchema, request.body);
    response.json({ data: await images.verify(currentUser(request), bearer(request)!, request.params.id, request.params.assetId) });
  });
  router.put("/properties/:id/images", async (request, response) => {
    const data = await images.gallery(currentUser(request), bearer(request)!, request.params.id, request.body, request.get("If-Match"));
    response.setHeader("ETag", data.etag);
    response.json({ data });
  });
  return router;
}
