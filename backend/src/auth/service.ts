import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, User, Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { bootstrapSchema, parseInput } from "./validation.js";

export const IDLE_MS = 12 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const publicUser = (user: User) => ({ id: user.id, role: user.role, name: user.name,
  email: user.email, phone: user.phone, photoUrl: user.photoUrl, biography: user.biography });
export type CurrentUser = ReturnType<typeof publicUser>;
const eligible = (user: User): boolean => user.accountStatus === "ACTIVE" && user.passwordHash !== null && user.passwordActivatedAt !== null;
const options = { maxWait: 15_000, timeout: 15_000 };
const securityEvent = (event: "ADMIN_INITIALIZED" | "SIGN_IN_FAILED" | "SIGN_IN_SUCCEEDED" | "SIGNED_OUT", userId?: string): void => {
  console.info(JSON.stringify({ event, userId, at: new Date().toISOString() }));
};

export async function revokeUserSessions(tx: Prisma.TransactionClient, userId: string, now = new Date()): Promise<void> {
  // Caller takes the User lock first, as do login/authenticate/logout.
  await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
}

export class AuthService {
  constructor(private db: PrismaClient, private clock: () => Date = () => new Date()) {}

  async bootstrap(input: unknown): Promise<string> {
    const data = parseInput(bootstrapSchema, input);
    const passwordHash = await hashPassword(data.password);
    const id = await this.db.$transaction(async tx => {
      // Shared invariant lock for any future admin eligibility mutations; no duplicated counter.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(706001::bigint)`;
      if (await tx.user.count({ where: { role: "ADMINISTRATOR" } }) !== 0) {
        throw new ApiError(409, "ADMIN_ALREADY_INITIALIZED", "An administrator already exists; bootstrap cannot replace it.");
      }
      const user = await tx.user.create({ data: { name: data.name, email: data.email, phone: data.phone,
        role: "ADMINISTRATOR", passwordHash, passwordActivatedAt: this.clock() } });
      return user.id;
    }, options);
    securityEvent("ADMIN_INITIALIZED", id);
    return id;
  }

  async login(email: string, password: string, previousToken?: string) {
    const result = await this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<User[]>`SELECT * FROM "User" WHERE email = ${email} FOR UPDATE`;
      const user = rows[0];
      const validPassword = await verifyPassword(password, user?.passwordHash ?? null);
      // Read time after acquiring the lock and hashing, so waiting calls cannot use stale time.
      const now = this.clock();
      if (!user || !eligible(user) || (user.lockoutUntil && user.lockoutUntil > now)) return null;
      if (!validPassword) {
        const failedLoginCount = (user.lockoutUntil && user.lockoutUntil <= now ? 0 : user.failedLoginCount) + 1;
        await tx.user.update({ where: { id: user.id }, data: { failedLoginCount,
          lockoutUntil: failedLoginCount >= 5 ? new Date(now.getTime() + LOCKOUT_MS) : null } });
        return null; // Commit failures/lockout; throwing inside this transaction would undo them.
      }
      await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockoutUntil: null } });
      if (previousToken && tokenPattern.test(previousToken)) {
        // Scope replacement revocation to this user; never lock another user's session out of order.
        await tx.session.updateMany({ where: { userId: user.id, tokenHash: hashToken(previousToken), revokedAt: null }, data: { revokedAt: now } });
      }
      const token = randomBytes(32).toString("base64url");
      const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_MS);
      await tx.session.create({ data: { userId: user.id, tokenHash: hashToken(token), createdAt: now,
        lastActivityAt: now, idleExpiresAt: new Date(now.getTime() + IDLE_MS), absoluteExpiresAt } });
      return { user: publicUser(user), token, absoluteExpiresAt };
    }, options);
    if (!result) {
      securityEvent("SIGN_IN_FAILED");
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    securityEvent("SIGN_IN_SUCCEEDED", result.user.id);
    return result;
  }

  async authenticate(token: string | undefined): Promise<CurrentUser> {
    if (!token || !tokenPattern.test(token)) throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
    const user = await this.db.$transaction(async tx => {
      const initial = await tx.session.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!initial) return null;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${initial.userId}::uuid FOR UPDATE`;
      const account = await tx.user.findUnique({ where: { id: initial.userId } });
      const session = await tx.session.findUnique({ where: { id: initial.id } });
      const now = this.clock();
      if (!account || !eligible(account)) {
        await revokeUserSessions(tx, initial.userId, now);
        return null;
      }
      if (!session || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return null;
      // Monotonic activity; never extend absolute expiry or resurrect an expired/revoked session.
      const activity = new Date(Math.max(now.getTime(), session.lastActivityAt.getTime()));
      await tx.session.update({ where: { id: session.id }, data: { lastActivityAt: activity,
        idleExpiresAt: new Date(Math.min(activity.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime())) } });
      return publicUser(account);
    }, options);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
    return user;
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token || !tokenPattern.test(token)) return;
    await this.db.$transaction(async tx => {
      const session = await tx.session.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!session) return;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${session.userId}::uuid FOR UPDATE`;
      await tx.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: this.clock() } });
    }, options);
    securityEvent("SIGNED_OUT");
  }
}
