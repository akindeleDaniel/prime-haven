import "dotenv/config";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { prisma, createDatabaseClient } from "../src/db/prisma.js";
import { confirmLocalDevelopmentDatabase } from "../src/db/local.js";
import { AuthService, hashToken, IDLE_MS, ABSOLUTE_MS, revokeUserSessions } from "../src/auth/service.js";
import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { parseInput, newPassword } from "../src/auth/validation.js";
import { ApiError, requestContext, errorHandler } from "../src/http/errors.js";
import { createApp } from "../src/app.js";
import { loginRateLimit, requireAuthentication, requireRoles } from "../src/auth/middleware.js";
import { getEnvironment } from "../src/config/environment.js";
import { type InvitationEmail, ZeptoMailInvitationMailer } from "../src/auth/email.js";
import { PropertyService } from "../src/properties/service.js";
import { generatePropertySlug } from "../src/properties/identity.js";
import { contentSchema, normalizeContent, states } from "../src/properties/validation.js";

const origin = "https://prime-haven.test";
const key = randomBytes(32).toString("hex");
const schema = `auth_test_${randomBytes(8).toString("hex")}`;
const password = `Test-${randomBytes(18).toString("hex")}`;
let time = Date.now();
let db: ReturnType<typeof createDatabaseClient>;
let service: AuthService;
let backend: Server;
let next: ChildProcess | undefined;
let api: string;
let bff: string;
let adminId: string;
let namespaceCreated = false;
const sentInvitationEmails: InvitationEmail[] = [];
const resetEmails: InvitationEmail[] = [];
let failResetEmail = false;
let failNextInvitationEmail = false;

const denied = (status: number) => (error: unknown) => error instanceof ApiError && error.status === status;
async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}
async function close(server?: Server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>(resolveClose => server.close(() => resolveClose()));
}
function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(api + "/api/v1" + path, { ...options, headers: {
    "X-BFF-Key": key, "Origin": origin, "X-Prime-Haven-CSRF": "1", "Content-Type": "application/json",
    ...options.headers,
  } });
}

before(async () => {
  const url = await confirmLocalDevelopmentDatabase(prisma, process.env.DATABASE_URL!);
  assert.match(schema, /^auth_test_[0-9a-f]{16}$/);
  // Create only a fresh random namespace; never reset/truncate public or pre-existing records.
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  namespaceCreated = true;
  url.searchParams.set("schema", schema);
  db = createDatabaseClient(url.toString());
  for (const migration of ["20261127010000_auth_foundation", "20261127020000_agent_invitations", "20261128010000_password_recovery", "20261128020000_property_drafts"]) {
    const sql = await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8");
    for (const statement of sql.split(";").filter(part => part.trim())) await db.$executeRawUnsafe(statement);
  }
  service = new AuthService(db, () => new Date(time), { sendInvitation: async email => {
    sentInvitationEmails.push(email);
    if (failNextInvitationEmail) { failNextInvitationEmail = false; throw new Error("Mock delivery failure"); }
  }, sendPasswordReset: async email => {
    resetEmails.push(email);
    if (failResetEmail) throw new Error("Mock provider failure with sensitive data");
  } });
  const bootstrapResults = await Promise.allSettled(Array.from({ length: 2 }, () => service.bootstrap({ name: "Test Administrator", email: "admin@example.test", phone: "+2348000000001", password })));
  const created = bootstrapResults.filter(result => result.status === "fulfilled");
  assert.equal(created.length, 1, "Concurrent bootstrap must initialize only one administrator.");
  assert.equal(bootstrapResults.filter(result => result.status === "rejected").length, 1);
  assert(created[0].status === "fulfilled");
  adminId = created[0].value;
  backend = createServer(createApp({ appOrigin: origin, bffSharedSecret: key }, service, new PropertyService(db)));
  api = await listen(backend);
}, { timeout: 30_000 });

after(async () => {
  await service?.waitForResetDeliveries();
  if (next && next.exitCode === null && next.signalCode === null) { const exited = once(next, "exit"); next.kill(); await exited; }
  await close(backend);
  if (db) await db.$disconnect();
  if (namespaceCreated && /^auth_test_[0-9a-f]{16}$/.test(schema)) await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await prisma.$disconnect();
});

test("bootstrap is one-time and cannot replace any existing administrator", async () => {
  await assert.rejects(service.bootstrap({ name: "Replacement", email: "other@example.test", phone: "+2348000000002", password }), denied(409));
  assert.equal(await db.user.count({ where: { role: "ADMINISTRATOR" } }), 1);
  const user = await db.user.findUniqueOrThrow({ where: { id: adminId } });
  assert.notEqual(user.passwordHash, password);
  assert.match(user.passwordHash!, /^\$2[aby]\$12\$/);
});

test("migration/bootstrap guards refuse remote, production-named and redirected database targets", async () => {
  for (const connection of ["postgresql://example.test/prime_haven_dev", "postgresql://localhost/prime_haven_prod", "postgresql://localhost/prime_haven_dev?host=example.test"]) {
    await assert.rejects(confirmLocalDevelopmentDatabase(db, connection));
  }
});

test("authentication configuration refuses weak keys and non-loopback HTTP", () => {
  const oldOrigin = process.env.APP_ORIGIN;
  const oldKey = process.env.BFF_SHARED_SECRET;
  const oldAllow = process.env.AUTH_ALLOW_LOCAL_HTTP;
  try {
    process.env.APP_ORIGIN = "http://example.test";
    process.env.BFF_SHARED_SECRET = key;
    process.env.AUTH_ALLOW_LOCAL_HTTP = "true";
    assert.throws(getEnvironment);
    process.env.APP_ORIGIN = origin;
    process.env.BFF_SHARED_SECRET = "short";
    assert.throws(getEnvironment);
  } finally {
    for (const [name, value] of Object.entries({ APP_ORIGIN: oldOrigin, BFF_SHARED_SECRET: oldKey, AUTH_ALLOW_LOCAL_HTTP: oldAllow })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("bcrypt salts differ; 72-byte limit rejects Unicode truncation and weak passwords", async () => {
  const hash = await hashPassword(password);
  const user = await db.user.findUniqueOrThrow({ where: { id: adminId } });
  assert.notEqual(hash, user.passwordHash);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
  assert.throws(() => parseInput(newPassword, "🦉".repeat(19)), denied(422));
  assert.throws(() => parseInput(newPassword, "short"), denied(422));
});

test("login/me/logout use a hashed opaque token and only safe response fields", async () => {
  const response = await apiFetch("/auth/sign-in", { method: "POST", body: JSON.stringify({ email: " ADMIN@example.test ", password }) });
  assert.equal(response.status, 200);
  const token = response.headers.get("X-Session-Token")!;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(response.headers.get("Set-Cookie"), null);
  const body = await response.json();
  assert.deepEqual(Object.keys(body.data).sort(), ["id","role","name","email","phone","photoUrl","biography"].sort());
  assert(!JSON.stringify(body).includes(token));
  const session = await db.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  assert.notEqual(session.tokenHash, token);
  assert.equal(session.absoluteExpiresAt.getTime() - session.createdAt.getTime(), ABSOLUTE_MS);
  const me = await apiFetch("/me", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
  assert.match(me.headers.get("Cache-Control")!, /no-store/);
  assert(me.headers.get("ETag"));
  assert.equal((await apiFetch("/auth/sign-out", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: "{}" })).status, 204);
  assert.equal((await apiFetch("/me", { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await apiFetch("/auth/sign-out", { method: "POST", body: "{}" })).status, 204);
});

test("five concurrent failures persist a 15-minute lock; expiry resets failures", async () => {
  const responses = await Promise.all(Array.from({ length: 5 }, () => service.login("admin@example.test", "incorrect-password").catch(error => error)));
  assert(responses.every(response => response instanceof ApiError && response.status === 401));
  const locked = await db.user.findUniqueOrThrow({ where: { id: adminId } });
  assert.equal(locked.failedLoginCount, 5);
  assert.equal(locked.lockoutUntil!.getTime(), time + 15 * 60_000);
  await assert.rejects(service.login("admin@example.test", password), denied(401));
  time += 15 * 60_000;
  await service.login("admin@example.test", password);
  const unlocked = await db.user.findUniqueOrThrow({ where: { id: adminId } });
  assert.equal(unlocked.failedLoginCount, 0);
  assert.equal(unlocked.lockoutUntil, null);
});

test("12-hour idle expiry and seven-day absolute expiry cannot be revived", async () => {
  const [zone] = await db.$queryRaw<{ zone: string }[]>`SELECT current_setting('TimeZone') AS zone`;
  assert.equal(zone.zone, "UTC");
  const first = await service.login("admin@example.test", password);
  time += IDLE_MS;
  await assert.rejects(service.authenticate(first.token), denied(401));
  const active = await service.login("admin@example.test", password);
  const start = time;
  for (let step = 1; step <= 15; step++) { time = start + step * 11 * 60 * 60_000; await service.authenticate(active.token); }
  const session = await db.session.findUniqueOrThrow({ where: { tokenHash: hashToken(active.token) } });
  assert.equal(session.absoluteExpiresAt.getTime(), start + ABSOLUTE_MS);
  assert.equal(session.idleExpiresAt.getTime(), start + ABSOLUTE_MS);
  time = start + ABSOLUTE_MS;
  await assert.rejects(service.authenticate(active.token), denied(401));
});

test("logout racing activity cannot resurrect a session; successful login rotates the current token", async () => {
  const session = await service.login("admin@example.test", password);
  await Promise.allSettled([service.authenticate(session.token), service.logout(session.token), service.authenticate(session.token)]);
  await assert.rejects(service.authenticate(session.token), denied(401));
  const old = await service.login("admin@example.test", password);
  const fresh = await service.login("admin@example.test", password, old.token);
  assert.notEqual(old.token, fresh.token);
  await assert.rejects(service.authenticate(old.token), denied(401));
});

test("current role, activation and account status are authoritative; revoked sessions remain revoked", async () => {
  const user = await db.user.create({ data: { name: "Agent", email: "agent@example.test", phone: "+2348000000003", role: "AGENT",
    passwordHash: await hashPassword(password), passwordActivatedAt: new Date(time) } });
  const session = await service.login(user.email, password);
  assert.equal((await service.authenticate(session.token)).role, "AGENT");
  await db.user.update({ where: { id: user.id }, data: { accountStatus: "DEACTIVATED", deactivatedAt: new Date(time) } });
  await assert.rejects(service.authenticate(session.token), denied(401));
  await assert.rejects(service.login(user.email, password), denied(401));
  await db.user.update({ where: { id: user.id }, data: { accountStatus: "ACTIVE", deactivatedAt: null } });
  await assert.rejects(service.authenticate(session.token), denied(401));
  const active = await service.login(user.email, password);
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
    await revokeUserSessions(tx, user.id, new Date(time));
  });
  await assert.rejects(service.authenticate(active.token), denied(401));
  await db.user.create({ data: { name: "Not activated", email: "inactive@example.test", phone: "+2348000000004", role: "AGENT" } });
  await assert.rejects(service.login("inactive@example.test", password), denied(401));
  await assert.rejects(service.login("unknown@example.test", password), denied(401));
});

test("database constraints protect normalized email, activation pairs, hashes and restrictive session relationships", async () => {
  await assert.rejects(db.user.create({ data: { name: "Invalid", email: "UPPER@example.test", phone: "+2348000000005", role: "AGENT" } }));
  await assert.rejects(db.user.create({ data: { name: "Invalid", email: "pair@example.test", phone: "+2348000000005", role: "AGENT", passwordHash: "hash" } }));
  await assert.rejects(db.session.create({ data: { userId: adminId, tokenHash: "raw-token", lastActivityAt: new Date(time), idleExpiresAt: new Date(time+IDLE_MS), absoluteExpiresAt: new Date(time+ABSOLUTE_MS) } }));
  await assert.rejects(db.user.delete({ where: { id: adminId } }));
});

test("only Administrators can create an unactivated agent; duplicate emails are rejected", async () => {
  const noSession = await apiFetch("/admin/agents", { method: "POST", body: JSON.stringify({ name: "Invited Agent", email: "invited@example.test", phone: "+2348000000010" }) });
  assert.equal(noSession.status, 401);
  const agentActor = await db.user.create({ data: { name: "Agent Actor", email: "actor@example.test", phone: "+2348000000011", role: "AGENT", passwordHash: await hashPassword(password), passwordActivatedAt: new Date(time) } });
  const agentSession = await service.login(agentActor.email, password);
  assert.equal((await apiFetch(`/admin/agents/${agentActor.id}/invitations`, { method: "POST", body: "{}" })).status, 401);
  assert.equal((await apiFetch(`/admin/agents/${agentActor.id}/invitations`, { method: "POST", headers: { Authorization: `Bearer ${agentSession.token}` }, body: "{}" })).status, 403);
  const deniedCreate = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${agentSession.token}` }, body: JSON.stringify({ name: "Invited Agent", email: "invited@example.test", phone: "+2348000000010" }) });
  assert.equal(deniedCreate.status, 403);
  const adminSession = await service.login("admin@example.test", password);
  const response = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: JSON.stringify({ name: "Invited Agent", email: " INVITED@example.test ", phone: "+2348000000010" }) });
  assert.equal(response.status, 201);
  const result = await response.json();
  const agent = result.data.agent;
  assert.equal(result.data.invitationDelivery, "SENT");
  assert.equal(agent.accountStatus, "ACTIVE");
  assert.equal(agent.passwordActivatedAt, null);
  assert(!JSON.stringify(result).includes(sentInvitationEmails.at(-1)!.token));
  const user = await db.user.findUniqueOrThrow({ where: { id: agent.id } });
  assert.equal(user.role, "AGENT");
  assert.equal(user.passwordHash, null);
  await assert.rejects(service.login(user.email, password), denied(401));
  const sent = sentInvitationEmails.at(-1)!;
  const stored = await db.invitation.findUniqueOrThrow({ where: { tokenHash: hashToken(sent.token) } });
  assert.notEqual(stored.tokenHash, sent.token);
  assert.equal(stored.expiresAt.getTime() - stored.createdAt.getTime(), 48 * 60 * 60 * 1000);
  assert.equal(await db.auditLog.count({ where: { affectedUserId: user.id, action: "AGENT_CREATED" } }), 1);
  assert.equal(await db.auditLog.count({ where: { affectedUserId: user.id, action: "INVITATION_ISSUED" } }), 1);
  const duplicate = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: JSON.stringify({ name: "Duplicate", email: "invited@example.test", phone: "+2348000000012" }) });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, "EMAIL_IN_USE");
});

test("resending revokes prior invitation and acceptance activates exactly once", async () => {
  const adminSession = await service.login("admin@example.test", password);
  const created = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: JSON.stringify({ name: "Activation Agent", email: "activation@example.test", phone: "+2348000000013" }) });
  const firstAgent = (await created.json()).data.agent;
  const firstEmail = sentInvitationEmails.at(-1)!;
  const firstRow = await db.invitation.findUniqueOrThrow({ where: { tokenHash: hashToken(firstEmail.token) } });
  const resent = await apiFetch(`/admin/agents/${firstAgent.id}/invitations`, { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: "{}" });
  assert.equal(resent.status, 202);
  const secondEmail = sentInvitationEmails.at(-1)!;
  assert.notEqual(firstEmail.token, secondEmail.token);
  assert((await db.invitation.findUniqueOrThrow({ where: { id: firstRow.id } })).revokedAt);
  await assert.rejects(service.acceptInvitation({ token: firstEmail.token, password }), denied(422));
  const attempts = await Promise.allSettled([service.acceptInvitation({ token: secondEmail.token, password }), service.acceptInvitation({ token: secondEmail.token, password })]);
  assert.equal(attempts.filter(attempt => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(attempt => attempt.status === "rejected").length, 1);
  const replay = await apiFetch("/auth/invitation-acceptances", { method: "POST", body: JSON.stringify({ token: secondEmail.token, password }) });
  assert.equal(replay.status, 422);
  const acceptedUser = await db.user.findUniqueOrThrow({ where: { id: firstAgent.id } });
  assert.equal(acceptedUser.role, "AGENT");
  assert(acceptedUser.passwordHash);
  assert(acceptedUser.passwordActivatedAt);
  assert.equal(await db.auditLog.count({ where: { affectedUserId: firstAgent.id, action: "PASSWORD_ACTIVATED" } }), 1);
  assert.equal((await service.login(acceptedUser.email, password)).user.id, acceptedUser.id);
  await assert.rejects(service.resendAgentInvitation(adminSession.user.id, firstAgent.id), denied(409));
});

test("expired or deactivated invitations cannot activate an account", async () => {
  const start = time;
  try {
    const adminSession = await service.login("admin@example.test", password);
    const response = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: JSON.stringify({ name: "Expired Agent", email: "expired@example.test", phone: "+2348000000014" }) });
    assert.equal(response.status, 201);
    const expiredToken = sentInvitationEmails.at(-1)!.token;
    time += 48 * 60 * 60 * 1000;
    await assert.rejects(service.acceptInvitation({ token: expiredToken, password }), denied(422));
    time = start;
    const second = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: JSON.stringify({ name: "Deactivated Agent", email: "deactivated@example.test", phone: "+2348000000015" }) });
    const deactivated = (await second.json()).data.agent;
    const deactivatedToken = sentInvitationEmails.at(-1)!.token;
    await db.user.update({ where: { id: deactivated.id }, data: { accountStatus: "DEACTIVATED", deactivatedAt: new Date(time) } });
    await assert.rejects(service.acceptInvitation({ token: deactivatedToken, password }), denied(422));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: deactivated.id } })).passwordHash, null);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: deactivated.id } })).accountStatus, "DEACTIVATED");
  } finally { time = start; }
});

test("email failure preserves an unactivated account and records delivery failure", async () => {
  failNextInvitationEmail = true;
  const adminSession = await service.login("admin@example.test", password);
  const response = await apiFetch("/admin/agents", { method: "POST", headers: { Authorization: `Bearer ${adminSession.token}` }, body: JSON.stringify({ name: "Mail Failure", email: "mail-failure@example.test", phone: "+2348000000016" }) });
  assert.equal(response.status, 201);
  const data = (await response.json()).data;
  assert.equal(data.invitationDelivery, "FAILED");
  assert.equal(data.agent.invitation.status, "PENDING");
  const user = await db.user.findUniqueOrThrow({ where: { id: data.agent.id } });
  assert.equal(user.passwordHash, null);
  assert.equal(user.passwordActivatedAt, null);
  const invitation = await db.invitation.findFirstOrThrow({ where: { userId: user.id } });
  assert.equal(invitation.deliveryStatus, "FAILED");
});

test("Express rejects hostile origin/transport, unexpected keys, malformed JSON/query and oversized bodies", async () => {
  assert.equal((await fetch(api + "/api/v1/me")).status, 403);
  const invalidHeaders: Record<string, string>[] = [{ Origin: "https://evil.test" }, { "X-Prime-Haven-CSRF": "" }, { "Content-Type": "text/plain" }];
  for (const headers of invalidHeaders) {
    const response = await apiFetch("/auth/sign-in", { method: "POST", headers, body: "{}" });
    assert([403, 415].includes(response.status));
  }
  for (const body of ['{"email":"a@b.test","password":"test-password","role":"ADMINISTRATOR"}', '{"$x":{}}', '{"a.b":1}', '{']) {
    const response = await apiFetch("/auth/sign-in", { method: "POST", body });
    assert.equal(response.status, 400);
    const error = await response.json();
    assert.deepEqual(Object.keys(error.error).sort(), ["status","code","message","fields","requestId"].sort());
    assert(!JSON.stringify(error).includes("test-password"));
  }
  assert.equal((await apiFetch("/me?role=ADMINISTRATOR")).status, 400);
  assert.equal((await apiFetch("/auth/sign-in", { method: "POST", body: JSON.stringify({ padding: "x".repeat(9000) }) })).status, 413);
});

async function recoveryUser(email: string) {
  return db.user.create({ data: { name: "Recovery Test", email, phone: "+2348000000050", role: "AGENT",
    passwordHash: await hashPassword(password), passwordActivatedAt: new Date(time) } });
}

test("recovery returns equivalent responses for unknown, deactivated, unactivated and eligible accounts; mail failure stays generic", async () => {
  const user = await recoveryUser("recovery-generic@example.test");
  const deactivated = await recoveryUser("recovery-disabled@example.test");
  await db.user.update({ where: { id: deactivated.id }, data: { accountStatus: "DEACTIVATED", deactivatedAt: new Date(time) } });
  const beforeCount = resetEmails.length;
  for (const email of ["unknown-reset@example.test", deactivated.email, "inactive@example.test", user.email]) {
    const response = await apiFetch("/auth/password-reset-requests", { method: "POST", body: JSON.stringify({ email }) });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { data: { message: "If eligible, password reset instructions will be sent." } });
    assert.equal(response.headers.get("X-Session-Token"), null);
  }
  await service.waitForResetDeliveries();
  assert.equal(resetEmails.length, beforeCount + 1);
  assert.equal(await db.passwordResetToken.count({ where: { userId: deactivated.id } }), 0);
  const row = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
  assert.equal(row.tokenHash, hashToken(resetEmails.at(-1)!.token));
  assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 30 * 60_000);
  const failureUser = await recoveryUser("recovery-email-failure@example.test");
  failResetEmail = true;
  try {
    const response = await apiFetch("/auth/password-reset-requests", { method: "POST", body: JSON.stringify({ email: failureUser.email }) });
    assert.equal(response.status, 202);
    await service.waitForResetDeliveries();
  } finally { failResetEmail = false; }
  assert(await db.passwordResetToken.findFirst({ where: { userId: failureUser.id } }));
});

test("reset cooldown persists, replacement invalidates old links, concurrent consumption succeeds once and revokes all sessions", async () => {
  const user = await recoveryUser("recovery-success@example.test");
  const firstSession = await service.login(user.email, password);
  const secondSession = await service.login(user.email, password);
  await service.requestPasswordReset({ email: user.email });
  await service.waitForResetDeliveries();
  const firstToken = resetEmails.at(-1)!.token;
  const count = resetEmails.length;
  await service.requestPasswordReset({ email: user.email });
  await service.waitForResetDeliveries();
  assert.equal(resetEmails.length, count);
  time += 60_000;
  await service.requestPasswordReset({ email: user.email });
  await service.waitForResetDeliveries();
  const token = resetEmails.at(-1)!.token;
  assert.notEqual(token, firstToken);
  await assert.rejects(service.resetPassword({ token: firstToken, newPassword: password + "x" }), denied(422));
  const attempts = await Promise.allSettled([service.resetPassword({ token, newPassword: password + "x" }), service.resetPassword({ token, newPassword: password + "x" })]);
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(result => result.status === "rejected").length, 1);
  await assert.rejects(service.resetPassword({ token, newPassword: password }), denied(422));
  for (const session of [firstSession, secondSession]) await assert.rejects(service.authenticate(session.token), denied(401));
  await assert.rejects(service.login(user.email, password), denied(401));
  assert.equal((await service.login(user.email, password + "x")).user.id, user.id);
  assert.equal(await db.auditLog.count({ where: { affectedUserId: user.id, action: "PASSWORD_RESET" } }), 1);
  assert.equal(await db.passwordResetToken.count({ where: { userId: user.id, consumedAt: null, revokedAt: null } }), 0);
});

test("expired, unknown and deactivated-account reset links fail without changing the password", async () => {
  const user = await recoveryUser("recovery-expired@example.test");
  await service.requestPasswordReset({ email: user.email });
  await service.waitForResetDeliveries();
  const token = resetEmails.at(-1)!.token;
  const start = time;
  time += 30 * 60_000;
  await assert.rejects(service.resetPassword({ token, newPassword: password + "x" }), denied(422));
  time = start;
  await db.user.update({ where: { id: user.id }, data: { accountStatus: "DEACTIVATED", deactivatedAt: new Date(time) } });
  await assert.rejects(service.resetPassword({ token, newPassword: password + "x" }), denied(422));
  await assert.rejects(service.resetPassword({ token: randomBytes(32).toString("base64url"), newPassword: password }), denied(422));
  assert(await verifyPassword(password, (await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash));
});

test("password change requires a live session and current password; success revokes sessions and outstanding reset tokens", async () => {
  const user = await recoveryUser("change-password@example.test");
  const session = await service.login(user.email, password);
  const otherSession = await service.login(user.email, password);
  await service.requestPasswordReset({ email: user.email });
  await service.waitForResetDeliveries();
  const token = resetEmails.at(-1)!.token;
  const body = JSON.stringify({ currentPassword: password, newPassword: password + "changed" });
  assert.equal((await apiFetch("/me/password", { method: "PUT", body })).status, 401);
  assert.equal((await apiFetch("/me/password", { method: "PUT", headers: { Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ currentPassword: "incorrect-password", newPassword: password + "changed" }) })).status, 422);
  assert.equal((await service.authenticate(session.token)).id, user.id);
  const changed = await apiFetch("/me/password", { method: "PUT", headers: { Authorization: `Bearer ${session.token}` }, body });
  assert.equal(changed.status, 204);
  for (const credential of [session.token, otherSession.token]) await assert.rejects(service.authenticate(credential), denied(401));
  await assert.rejects(service.changePassword(session.token, { currentPassword: password + "changed", newPassword: password }), denied(401));
  await assert.rejects(service.resetPassword({ token, newPassword: password }), denied(422));
  assert.equal((await service.login(user.email, password + "changed")).user.id, user.id);
  assert.equal(await db.auditLog.count({ where: { affectedUserId: user.id, action: "PASSWORD_CHANGED" } }), 1);
  const audit = await db.auditLog.findMany({ where: { affectedUserId: user.id } });
  for (const secret of [password, token, user.email]) assert(!JSON.stringify(audit).includes(secret));
});

test("recovery endpoints rate limit independently of account existence or spoofed forwarding headers", async () => {
  const server = createServer(createApp({ appOrigin: origin, bffSharedSecret: key }, service));
  const base = await listen(server);
  try {
    for (let index = 0; index < 31; index++) {
      const response = await fetch(base + "/api/v1/auth/password-reset-requests", { method: "POST", headers: {
        "X-BFF-Key": key, Origin: origin, "X-Prime-Haven-CSRF": "1", "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${index}`,
      }, body: JSON.stringify({ email: "rate-unknown@example.test" }) });
      assert.equal(response.status, index < 30 ? 202 : 429);
      if (index === 30) assert(response.headers.get("Retry-After"));
    }
  } finally { await close(server); }
});

test("ZeptoMail reset uses a trusted origin, escaped content and bounded provider request with mocked fetch", async () => {
  const originalFetch = globalThis.fetch;
  const saved = { APP_ORIGIN: process.env.APP_ORIGIN, ZEPTOMAIL_API_TOKEN: process.env.ZEPTOMAIL_API_TOKEN, ZEPTOMAIL_FROM_EMAIL: process.env.ZEPTOMAIL_FROM_EMAIL };
  let captured: Record<string, unknown> | undefined;
  try {
    process.env.APP_ORIGIN = origin;
    process.env.ZEPTOMAIL_API_TOKEN = "mock-only-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "sender@example.test";
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.zeptomail.com/v1.1/email");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Zoho-enczapikey mock-only-token");
      assert.equal(init?.redirect, "error");
      assert(init?.signal);
      captured = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 202 });
    };
    await new ZeptoMailInvitationMailer().sendPasswordReset({ recipientName: "<script>", recipientEmail: "recipient@example.test", token: "mock-reset-token", expiresAt: new Date(time + 30 * 60_000) });
    assert(captured);
    assert(String(captured.htmlbody).includes("&lt;script&gt;"));
    assert(String(captured.htmlbody).includes(origin + "/reset-password?token=mock-reset-token"));
    assert(String(captured.textbody).includes("30 minutes"));
    globalThis.fetch = async () => { throw new Error("Simulated failure"); };
    await assert.rejects(new ZeptoMailInvitationMailer().sendPasswordReset({ recipientName: "Name", recipientEmail: "recipient@example.test", token: "mock-reset-token", expiresAt: new Date(time) }));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("role middleware rejects Agent for Administrator operation and limiter ignores spoofed forwarding headers", async () => {
  const app = express();
  app.use(requestContext);
  const agent = await service.login("agent@example.test", password);
  app.get("/admin", requireAuthentication(service), requireRoles("ADMINISTRATOR"), (_req, res) => res.json({ ok:true }));
  app.get("/limited", loginRateLimit(1), (_req, res) => res.end());
  app.use(errorHandler);
  const server = createServer(app);
  const base = await listen(server);
  try {
    assert.equal((await fetch(base+"/admin", { headers: { Authorization: `Bearer ${agent.token}` } })).status, 403);
    assert.equal((await fetch(base+"/limited", { headers: { "X-Forwarded-For": "1.1.1.1" } })).status, 200);
    const limited = await fetch(base+"/limited", { headers: { "X-Forwarded-For": "2.2.2.2" } });
    assert.equal(limited.status, 429);
    assert(limited.headers.get("Retry-After"));
  } finally { await close(server); }
});

test("draft Zod validation rejects invalid prices, fields, ranges and conditional contradictions", () => {
  for (const priceNaira of ["0","-1","1.5","1e6","9223372036854775808","abc",100]) {
    assert.throws(() => parseInput(contentSchema, { priceNaira }), denied(422));
  }
  for (const content of [{ bedrooms:21 }, { bedrooms:-1 }, { parkingSpaces:1.1 }, { floorAreaSqm:"0" }, { plotSizeSqm:"1.001" },
    { floorAreaSqm:"10000000000" }, { title:"short" }, { description:"short" }, { state:"Unknown" }, { showExactAddress:"false" }]) {
    assert.throws(() => parseInput(contentSchema, content), denied(422));
  }
  assert.equal(states.length,37);
  for (const state of states) assert.equal(parseInput(contentSchema, { state }).state,state);
  assert.throws(() => parseInput(contentSchema, { ownerId:adminId }),denied(400));
  assert.throws(() => normalizeContent({}, { propertyType:"LAND",bedrooms:1 }),denied(422));
  assert.throws(() => normalizeContent({}, { propertyType:"OFFICE",plotSizeSqm:"1" }),denied(422));
  assert.throws(() => normalizeContent({}, { purpose:"FOR_SALE",rentPeriod:"PER_MONTH" }),denied(422));
  assert.deepEqual(normalizeContent({ propertyType:"HOUSE",bedrooms:2,furnishing:"FURNISHED",floorAreaSqm:"50" }, { propertyType:"LAND" }),
    { propertyType:"LAND",bedrooms:null,furnishing:null,floorAreaSqm:null,bathrooms:null,toilets:null,parkingSpaces:null });
  assert.equal(generatePropertySlug("A prime home in Lagos", "PH-000123"),"a-prime-home-in-lagos-000123");
  assert.notEqual(generatePropertySlug("Same Title","PH-000123"),generatePropertySlug("Same Title","PH-000124"));
});

test("agents create, retrieve, filter and manually edit incomplete own drafts with stale-write protection", async () => {
  time = Date.now();
  const agent = await recoveryUser("draft-owner@example.test");
  const session = await service.login(agent.email,password);
  const headers = { Authorization: `Bearer ${session.token}` };
  const amenity = await db.amenity.create({data:{name:"Draft test parking"}});
  const response = await apiFetch("/agent/properties",{method:"POST",headers,body:"{}"});
  assert.equal(response.status,201);
  const empty = (await response.json()).data;
  assert.match(empty.reference,/^PH-\d{6,}$/);
  assert.equal(empty.slug,null); assert.equal(empty.publishedAt,null); assert.equal(empty.status,"DRAFT");
  assert.equal(empty.content.negotiable,false); assert.equal(empty.content.showExactAddress,true);
  assert.equal(empty.content.title,null); assert(empty.missingRequirements.length > 0);
  assert.equal(response.headers.get("ETag"),empty.etag);
  assert.equal(response.headers.get("Location"),`/api/v1/agent/properties/${empty.id}`);
  assert.equal((await apiFetch(`/agent/properties/${empty.id}`,{headers})).status,200);
  const body = JSON.stringify({content:{title:"A private property draft",priceNaira:"9223372036854775807",propertyType:"HOUSE",bedrooms:0,exactAddress:"12 Example Street",showExactAddress:false},amenityIds:[amenity.id]});
  assert.equal((await apiFetch(`/agent/properties/${empty.id}`,{method:"PATCH",headers,body})).status,428);
  const changed = await apiFetch(`/agent/properties/${empty.id}`,{method:"PATCH",headers:{...headers,"If-Match":empty.etag},body});
  assert.equal(changed.status,200);
  const saved = (await changed.json()).data;
  assert.equal(saved.content.priceNaira,"9223372036854775807"); assert.equal(saved.content.exactAddress,"12 Example Street");
  assert.equal(saved.content.showExactAddress,false); assert.equal(saved.content.bedrooms,0); assert.equal(saved.version,2);
  assert.equal((await apiFetch(`/agent/properties/${empty.id}`,{method:"PATCH",headers:{...headers,"If-Match":empty.etag},body})).status,412);
  const outcomes = await Promise.all([1,2].map(index => apiFetch(`/agent/properties/${empty.id}`,{method:"PATCH",headers:{...headers,"If-Match":saved.etag},body:JSON.stringify({content:{city:"Test city "+index}})})));
  assert.deepEqual(outcomes.map(item=>item.status).sort(),[200,412]);
  const list = await apiFetch("/agent/properties?status=DRAFT&page=1&pageSize=1&sort=created_desc",{headers});
  assert.equal(list.status,200); const data = await list.json();
  assert.equal(data.pagination.total,1); assert.equal(data.data[0].id,empty.id); assert.match(list.headers.get("Cache-Control")!,/no-store/);
  assert.equal((await apiFetch("/agent/properties?ownerId="+agent.id,{headers})).status,400);
  assert.equal((await apiFetch("/agent/properties?page=1&page=2",{headers})).status,400);
  assert.equal((await apiFetch("/agent/properties?status=ARCHIVED",{headers})).status,422);
  assert.equal((await (await apiFetch("/agent/properties?rejectedOnly=true",{headers})).json()).pagination.total,0);
  const audit = await db.auditLog.findMany({where:{propertyId:empty.id}});
  assert.equal(audit.length,3); assert(!JSON.stringify(audit).includes("Example Street"));
  assert.equal((await apiFetch("/public/properties/"+empty.id)).status,404);
});

test("residential, commercial and land draft edits clear irrelevant fields and preserve valid partial values", async () => {
  const session = await service.login("draft-owner@example.test",password);
  const headers = { Authorization: `Bearer ${session.token}` };
  const created = await apiFetch("/agent/properties",{method:"POST",headers,body:JSON.stringify({content:{propertyType:"HOUSE",bedrooms:3,bathrooms:2,toilets:2,furnishing:"FURNISHED",parkingSpaces:1,floorAreaSqm:"12.50",purpose:"FOR_RENT",rentPeriod:"PER_YEAR",state:"Akwa Ibom"}})});
  assert.equal(created.status,201); let draft = (await created.json()).data;
  assert.equal(draft.content.state,"Akwa Ibom");
  for (const content of [{propertyType:"OFFICE",floorAreaSqm:"0.01"},{propertyType:"LAND",plotSizeSqm:"250.50",titleDocumentType:"Owner-described document"},{purpose:"FOR_SALE"}]) {
    const edit = await apiFetch(`/agent/properties/${draft.id}`,{method:"PATCH",headers:{...headers,"If-Match":draft.etag},body:JSON.stringify({content})});
    assert.equal(edit.status,200); draft = (await edit.json()).data;
  }
  for (const key of ["bedrooms","bathrooms","toilets","furnishing","parkingSpaces","floorAreaSqm","rentPeriod"]) assert.equal(draft.content[key],null);
  assert.equal(draft.content.plotSizeSqm,"250.5");
  const inactive = await db.amenity.create({data:{name:"Inactive amenity",isActive:false}});
  assert.equal((await apiFetch("/agent/properties",{method:"POST",headers,body:JSON.stringify({amenityIds:[inactive.id]})})).status,422);
});

test("duplication copies content and amenities into a fresh neutral draft without source workflow identity", async () => {
  const session = await service.login("draft-owner@example.test",password);
  const headers = { Authorization: `Bearer ${session.token}` };
  const source = await db.property.findFirstOrThrow({where:{ownerId:session.user.id,title:"A private property draft"}});
  await db.property.update({where:{id:source.id},data:{slug:generatePropertySlug(source.title!,source.reference),publishedAt:new Date(),verified:true,verifiedById:adminId,verifiedAt:new Date(),submittedAt:new Date(),rejectionReason:"Private rejection"}});
  const duplicate = await apiFetch(`/agent/properties/${source.id}/duplicates`,{method:"POST",headers,body:"{}"});
  assert.equal(duplicate.status,201); const copy = (await duplicate.json()).data;
  assert.notEqual(copy.reference,source.reference); assert.notEqual(copy.id,source.id);
  assert.equal(copy.content.exactAddress,source.exactAddress); assert.equal(copy.content.showExactAddress,false);
  assert.equal(copy.amenityIds.length,1); assert.equal(copy.version,1);
  for (const key of ["slug","publishedAt","submittedAt","archivedAt","rejectionReason","verifiedById","verifiedAt","featuredAt"]) assert.equal(copy[key],null);
  assert.equal(copy.verified,false); assert.equal(copy.featured,false); assert.equal(copy.viewCount,"0"); assert.deepEqual(copy.gallery,[]);
  const events = await db.auditLog.findMany({where:{propertyId:copy.id}});
  assert.equal(events.length,1); assert.equal(events[0].action,"PROPERTY_DUPLICATED");
  const current = (await (await apiFetch(`/agent/properties/${source.id}`,{headers})).json()).data;
  const materialEdit = await apiFetch(`/agent/properties/${source.id}`,{method:"PATCH",headers:{...headers,"If-Match":current.etag},body:JSON.stringify({content:{priceNaira:"100"}})});
  assert.equal(materialEdit.status,200);
  const materialResult = (await materialEdit.json()).data;
  assert.equal(materialResult.verified,false); assert.equal(materialResult.verifiedById,null); assert.equal(materialResult.verifiedAt,null);
});

test("ownership and role checks prevent direct and stale cross-agent property access", async () => {
  const other = await recoveryUser("other-draft-owner@example.test");
  const session = await service.login(other.email,password);
  const admin = await service.login("admin@example.test",password);
  const source = await db.property.findFirstOrThrow({where:{title:"A private property draft"}});
  const headers = { Authorization: `Bearer ${session.token}` };
  assert.equal((await apiFetch("/agent/properties",{method:"POST",body:"{}"})).status,401);
  assert.equal((await apiFetch("/agent/properties",{method:"POST",headers:{Authorization:`Bearer ${admin.token}`},body:"{}"})).status,403);
  for (const options of [{method:"GET"},{method:"PATCH",body:"{}",headers:{...headers,"If-Match":'"stale"'}},{method:"POST",body:"{}"}]) {
    const suffix = options.method === "POST" ? "/duplicates" : "";
    assert.equal((await apiFetch(`/agent/properties/${source.id}`+suffix,{...options,headers:options.headers??headers})).status,404);
  }
  assert.equal((await (await apiFetch("/agent/properties",{headers})).json()).pagination.total,0);
  const owner = await service.login("draft-owner@example.test",password);
  await db.property.update({where:{id:source.id},data:{ownerId:other.id,version:{increment:1}}});
  assert.equal((await apiFetch(`/agent/properties/${source.id}`,{headers:{Authorization:`Bearer ${owner.token}`}})).status,404);
  await db.user.update({where:{id:other.id},data:{accountStatus:"DEACTIVATED",deactivatedAt:new Date()}});
  assert.equal((await apiFetch("/agent/properties",{headers})).status,401);
  await assert.rejects(db.property.update({where:{id:source.id},data:{priceNaira:0n}}));
});

test("concurrent references remain unique beyond six digits", async () => {
  const session = await service.login("draft-owner@example.test",password);
  await db.$queryRaw`SELECT setval('property_reference_seq',999999)`;
  const requests = await Promise.all(Array.from({length:4},()=>apiFetch("/agent/properties",{method:"POST",headers:{Authorization:`Bearer ${session.token}`},body:"{}"})));
  assert(requests.every(response=>response.status===201));
  const drafts = await Promise.all(requests.map(response=>response.json()));
  assert.equal(new Set(drafts.map(({data})=>data.reference)).size,4);
  assert(drafts.every(({data})=>/^PH-100000[0-3]$/.test(data.reference)));
});

test("real Next BFF sets secure host-only cookie, strips secrets, enforces CSRF and forwards only the cookie credential", { timeout: 40_000 }, async () => {
  // Restore wall clock before issuing browser cookies after expiry tests used a fake clock.
  time = Date.now();
  const frontend = resolve("../frontend");
  await access(resolve(frontend, ".next/BUILD_ID"));
  const reserve = createServer();
  const base = await listen(reserve);
  const port = new URL(base).port;
  await close(reserve);
  bff = base;
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
    cwd: frontend, windowsHide: true, stdio: "ignore", env: { ...process.env, APP_ORIGIN: origin, SITE_URL: origin,
      API_BASE_URL: api, BFF_SHARED_SECRET: key, AUTH_ALLOW_LOCAL_HTTP: "true" },
  });
  let ready = false;
  for (let attempt=0; attempt<150; attempt++) {
    if (next.exitCode !== null) throw new Error("Next test server exited before ready.");
    try { await fetch(bff+"/api/v1/me"); ready=true; break; } catch { await new Promise(resolveDelay=>setTimeout(resolveDelay,100)); }
  }
  assert(ready, "Build frontend before running authentication tests.");
  const body = JSON.stringify({ email:"admin@example.test",password });
  const headers = { "Content-Type":"application/json", "Origin":origin,"X-Prime-Haven-CSRF":"1", "Sec-Fetch-Site":"same-origin" };
  assert.equal((await fetch(bff+"/api/v1/auth/sign-in", { method:"POST", headers:{"Content-Type":"application/json"},body })).status,403);
  assert.equal((await fetch(bff+"/api/v1/auth/sign-in", { method:"POST", headers:{...headers,Origin:"https://evil.test"},body })).status,403);
  assert.equal((await fetch(bff+"/api/v1/auth/sign-in", { method:"POST", headers:{...headers,"X-Prime-Haven-CSRF":""},body })).status,403);
  assert.equal((await fetch(bff+"/api/v1/auth/sign-in", { method:"POST", headers:{...headers,"Sec-Fetch-Site":"same-site"},body })).status,403);
  const response = await fetch(bff+"/api/v1/auth/sign-in", { method:"POST",headers,body });
  assert.equal(response.status,200);
  const cookie = response.headers.get("Set-Cookie")!;
  assert.match(cookie,/^__Host-ph-session=/);
  for (const attribute of [/HttpOnly/i,/Secure/i,/SameSite=strict/i,/Path=\//i]) assert.match(cookie,attribute);
  assert(!/Domain=/i.test(cookie));
  assert.equal(response.headers.get("X-Session-Token"),null);
  assert.equal(response.headers.get("X-Session-Expires"),null);
  const sessionCookie = cookie.split(";")[0];
  assert.equal((await fetch(bff+"/api/v1/me", {headers:{Cookie:sessionCookie+"; "+sessionCookie}})).status,400);
  assert.equal((await fetch(bff+"/api/v1/auth/sign-in", {method:"POST",headers,body:JSON.stringify({padding:"x".repeat(9000)})})).status,413);
  const me = await fetch(bff+"/api/v1/me", {headers:{Cookie:sessionCookie,Authorization:"Bearer attacker","X-BFF-Key":"attacker"}});
  assert.equal(me.status,200);
  assert.equal((await me.json()).data.id,adminId);
  assert.match(me.headers.get("Cache-Control")!,/no-store/);
  assert.equal((await fetch(bff+"/api/v1/me", {headers:{Authorization:"Bearer attacker"}})).status,401);
  const adminCookie = { ...headers, Cookie: sessionCookie };
  const deniedCreate = await fetch(bff+"/api/v1/admin/agents", { method:"POST",headers,body:JSON.stringify({name:"No Session",email:"bff-denied@example.test",phone:"+2348000000020"}) });
  assert.equal(deniedCreate.status,401);
  const createAgent = await fetch(bff+"/api/v1/admin/agents", { method:"POST",headers:adminCookie,body:JSON.stringify({name:"BFF Agent",email:"bff-agent@example.test",phone:"+2348000000021"}) });
  assert.equal(createAgent.status,201);
  const createResult = await createAgent.json();
  const bffAgentId = createResult.data.agent.id as string;
  const firstInvitationToken = sentInvitationEmails.at(-1)!.token;
  assert(!JSON.stringify(createResult).includes(firstInvitationToken));
  const resend = await fetch(bff+`/api/v1/admin/agents/${bffAgentId}/invitations`, { method:"POST",headers:adminCookie,body:"{}" });
  assert.equal(resend.status,202);
  const replacementToken = sentInvitationEmails.at(-1)!.token;
  assert.notEqual(replacementToken, firstInvitationToken);
  const activate = await fetch(bff+"/api/v1/auth/invitation-acceptances", { method:"POST",headers,body:JSON.stringify({token:replacementToken,password}) });
  assert.equal(activate.status,204);
  const resetRequest = await fetch(bff+"/api/v1/auth/password-reset-requests", { method:"POST", headers, body:JSON.stringify({email:"bff-agent@example.test"}) });
  assert.equal(resetRequest.status,202);
  await service.waitForResetDeliveries();
  const resetToken = resetEmails.at(-1)!.token;
  assert.equal((await fetch(bff+"/api/v1/auth/password-resets", { method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify({token:resetToken,newPassword:password+"bff"}) })).status,403);
  const reset = await fetch(bff+"/api/v1/auth/password-resets", { method:"POST", headers,body:JSON.stringify({token:resetToken,newPassword:password+"bff"}) });
  assert.equal(reset.status,204);
  assert.match(reset.headers.get("Set-Cookie")!,/Max-Age=0/);
  const newLogin = await fetch(bff+"/api/v1/auth/sign-in", { method:"POST", headers,body:JSON.stringify({email:"bff-agent@example.test",password:password+"bff"}) });
  assert.equal(newLogin.status,200);
  const newCookie = newLogin.headers.get("Set-Cookie")!.split(";")[0];
  assert.equal((await fetch(bff+"/api/v1/me/password", { method:"PUT",headers,body:JSON.stringify({currentPassword:password+"bff",newPassword:password+"final"}) })).status,401);
  const change = await fetch(bff+"/api/v1/me/password", { method:"PUT",headers:{...headers,Cookie:newCookie},body:JSON.stringify({currentPassword:password+"bff",newPassword:password+"final"}) });
  assert.equal(change.status,204);
  assert.match(change.headers.get("Set-Cookie")!,/Max-Age=0/);
  assert.equal((await fetch(bff+"/api/v1/me", {headers:{Cookie:newCookie}})).status,401);
  const propertyLogin = await fetch(bff+"/api/v1/auth/sign-in", {method:"POST",headers,body:JSON.stringify({email:"bff-agent@example.test",password:password+"final"})});
  assert.equal(propertyLogin.status,200);
  const propertyCookie = propertyLogin.headers.get("Set-Cookie")!.split(";")[0];
  const propertyHeaders = {...headers,Cookie:propertyCookie};
  assert.equal((await fetch(bff+"/api/v1/agent/properties",{method:"POST",headers:{...headers,Cookie:sessionCookie},body:"{}"})).status,403);
  assert.equal((await fetch(bff+"/api/v1/agent/properties",{method:"POST",headers:{...propertyHeaders,Origin:"https://evil.test"},body:"{}"})).status,403);
  const propertyCreate = await fetch(bff+"/api/v1/agent/properties",{method:"POST",headers:propertyHeaders,body:JSON.stringify({content:{title:"BFF property draft",exactAddress:"Private test address",showExactAddress:false}})});
  assert.equal(propertyCreate.status,201);
  assert.equal(propertyCreate.headers.get("X-Session-Token"),null);
  const propertyDraft = (await propertyCreate.json()).data;
  const propertyRead = await fetch(bff+"/api/v1/agent/properties/"+propertyDraft.id,{headers:propertyHeaders});
  assert.equal(propertyRead.status,200); assert.match(propertyRead.headers.get("Cache-Control")!,/no-store/);
  const propertyEdit = await fetch(bff+"/api/v1/agent/properties/"+propertyDraft.id,{method:"PATCH",headers:{...propertyHeaders,"If-Match":propertyDraft.etag},body:JSON.stringify({content:{priceNaira:"123456789012345"}})});
  assert.equal(propertyEdit.status,200); assert.equal((await propertyEdit.json()).data.content.priceNaira,"123456789012345");
  const propertyCopy = await fetch(bff+"/api/v1/agent/properties/"+propertyDraft.id+"/duplicates",{method:"POST",headers:propertyHeaders,body:"{}"});
  assert.equal(propertyCopy.status,201);
  const propertyList = await fetch(bff+"/api/v1/agent/properties?status=DRAFT&pageSize=1",{headers:propertyHeaders});
  assert.equal(propertyList.status,200); assert.equal((await propertyList.json()).pagination.total,2);
  assert.equal((await fetch(bff+"/api/v1/agent/properties?ownerId="+adminId,{headers:propertyHeaders})).status,400);
  assert.equal((await fetch(bff+"/api/v1/agent/properties",{headers:{Authorization:`Bearer ${propertyCookie}`}})).status,401);
  assert.equal((await fetch(bff+"/api/v1/auth/sign-out",{method:"POST",headers:{...headers,Cookie:sessionCookie},body:"{}"})).status,204);
  const replay = await fetch(bff+"/api/v1/me", {headers:{Cookie:sessionCookie}});
  assert.equal(replay.status,401);
  assert.match(replay.headers.get("Set-Cookie")!,/Max-Age=0/);
});
