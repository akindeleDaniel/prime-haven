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
  const sql = await readFile("prisma/migrations/20261127010000_auth_foundation/migration.sql", "utf8");
  for (const statement of sql.split(";").filter(part => part.trim())) await db.$executeRawUnsafe(statement);
  service = new AuthService(db, () => new Date(time));
  const bootstrapResults = await Promise.allSettled(Array.from({ length: 2 }, () => service.bootstrap({ name: "Test Administrator", email: "admin@example.test", phone: "+2348000000001", password })));
  const created = bootstrapResults.filter(result => result.status === "fulfilled");
  assert.equal(created.length, 1, "Concurrent bootstrap must initialize only one administrator.");
  assert.equal(bootstrapResults.filter(result => result.status === "rejected").length, 1);
  assert(created[0].status === "fulfilled");
  adminId = created[0].value;
  backend = createServer(createApp({ appOrigin: origin, bffSharedSecret: key }, service));
  api = await listen(backend);
}, { timeout: 30_000 });

after(async () => {
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
  assert.equal((await fetch(bff+"/api/v1/auth/sign-out",{method:"POST",headers:{...headers,Cookie:sessionCookie},body:"{}"})).status,204);
  const replay = await fetch(bff+"/api/v1/me", {headers:{Cookie:sessionCookie}});
  assert.equal(replay.status,401);
  assert.match(replay.headers.get("Set-Cookie")!,/Max-Age=0/);
});
