import { createHash } from "node:crypto";
import { Router } from "express";
import { bearer, currentUser, loginRateLimit, requireAuthentication, requireRoles } from "../auth/middleware.js";
import type { AuthService } from "../auth/service.js";
import { emptySchema, loginSchema, parseInput } from "../auth/validation.js";

export function authRouter(service: AuthService): Router {
  const router = Router();
  router.post("/auth/sign-in", loginRateLimit(), async (request, response) => {
    const input = parseInput(loginSchema, request.body);
    const session = await service.login(input.email, input.password, bearer(request));
    // Internal only: Next validates these, owns Set-Cookie and strips the headers.
    response.setHeader("X-Session-Token", session.token);
    response.setHeader("X-Session-Expires", session.absoluteExpiresAt.toISOString());
    response.json({ data: session.user });
  });
  router.post("/auth/sign-out", async (request, response) => {
    parseInput(emptySchema, request.body ?? {});
    await service.logout(bearer(request));
    response.status(204).end();
  });
  router.get("/me", requireAuthentication(service), requireRoles("AGENT", "ADMINISTRATOR"), (request, response) => {
    const user = currentUser(request);
    response.setHeader("ETag", `"${createHash("sha256").update(JSON.stringify(user)).digest("hex")}"`);
    response.json({ data: user });
  });
  return router;
}
