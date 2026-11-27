import { createHash } from "node:crypto";
import { Router } from "express";
import { bearer, currentUser, loginRateLimit, requireAuthentication, requireRoles } from "../auth/middleware.js";
import type { AuthService } from "../auth/service.js";
import { agentCreateSchema, emptySchema, loginSchema, parseInput } from "../auth/validation.js";

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
  router.post("/auth/invitation-acceptances", loginRateLimit(), async (request, response) => {
    await service.acceptInvitation(request.body);
    response.status(204).end();
  });
  router.post("/admin/agents", requireAuthentication(service), requireRoles("ADMINISTRATOR"), async (request, response) => {
    const input = parseInput(agentCreateSchema, request.body);
    response.status(201).json({ data: await service.createAgent(currentUser(request).id, input) });
  });
  router.post("/admin/agents/:id/invitations", requireAuthentication(service), requireRoles("ADMINISTRATOR"), async (request, response) => {
    parseInput(emptySchema, request.body ?? {});
    response.status(202).json({ data: await service.resendAgentInvitation(currentUser(request).id, request.params.id) });
  });
  return router;
}
