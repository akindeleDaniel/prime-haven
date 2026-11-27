import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, User, Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { agentCreateSchema, agentIdSchema, bootstrapSchema, invitationAcceptanceSchema, parseInput } from "./validation.js";
import { type InvitationMailer, ZeptoMailInvitationMailer } from "./email.js";

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
const securityEvent = (event: "ADMIN_INITIALIZED" | "SIGN_IN_FAILED" | "SIGN_IN_SUCCEEDED" | "SIGNED_OUT" | "AGENT_INVITATION_CREATED" | "AGENT_INVITATION_RESENT" | "AGENT_INVITATION_ACCEPTED" | "INVITATION_EMAIL_FAILED", userId?: string): void => {
  console.info(JSON.stringify({ event, userId, at: new Date().toISOString() }));
};

export async function revokeUserSessions(tx: Prisma.TransactionClient, userId: string, now = new Date()): Promise<void> {
  // Caller takes the User lock first, as do login/authenticate/logout.
  await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
}

async function lockAdministrator(tx: Prisma.TransactionClient, actorId: string, subjectId?: string): Promise<void> {
  for (const id of [...new Set([actorId, ...(subjectId ? [subjectId] : [])])].sort()) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
  }
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.role !== "ADMINISTRATOR" || !eligible(actor)) {
    throw new ApiError(403, "FORBIDDEN", "An active Administrator is required.");
  }
}

export class AuthService {
  constructor(private db: PrismaClient, private clock: () => Date = () => new Date(), private invitationMailer: InvitationMailer = new ZeptoMailInvitationMailer()) {}

  private async sendInvitation(user: { id: string; name: string; email: string }, invitation: { id: string; token: string; expiresAt: Date }): Promise<"SENT" | "FAILED"> {
    let status: "SENT" | "FAILED" = "SENT";
    try {
      await this.invitationMailer.sendInvitation({ recipientName: user.name, recipientEmail: user.email, token: invitation.token, expiresAt: invitation.expiresAt });
    } catch {
      status = "FAILED";
      securityEvent("INVITATION_EMAIL_FAILED", user.id);
    }
    await this.db.invitation.update({ where: { id: invitation.id }, data: { deliveryStatus: status } });
    return status;
  }

  private async issueInvitation(userId: string, actorId: string): Promise<{ user: { id: string; name: string; email: string }; invitation: { id: string; token: string; expiresAt: Date } }> {
    return this.db.$transaction(async tx => {
      await lockAdministrator(tx, actorId, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== "AGENT" || user.accountStatus !== "ACTIVE" || user.passwordHash !== null || user.passwordActivatedAt !== null) {
        throw new ApiError(409, "INVALID_TRANSITION", "This agent cannot receive an invitation.");
      }
      const now = this.clock();
      await tx.invitation.updateMany({ where: { userId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const invitation = await tx.invitation.create({ data: { userId, tokenHash: hashToken(token), createdAt: now, expiresAt } });
      await tx.auditLog.create({ data: { actorId, affectedUserId: userId, action: "INVITATION_ISSUED", subjectType: "USER", subjectReference: userId, summary: "Agent activation invitation issued." } });
      return { user: { id: user.id, name: user.name, email: user.email }, invitation: { id: invitation.id, token, expiresAt } };
    }, options);
  }

  private async deliverInvitation(issue: Awaited<ReturnType<AuthService["issueInvitation"]>>): Promise<"SENT" | "FAILED"> {
    return this.sendInvitation(issue.user, issue.invitation);
  }

  async createAgent(actorId: string, input: unknown) {
    const data = parseInput(agentCreateSchema, input);
    const token = randomBytes(32).toString("base64url");
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    let created: { id: string; name: string; email: string; phone: string; accountStatus: "ACTIVE"; createdAt: Date; updatedAt: Date; invitationId: string };
    try {
      created = await this.db.$transaction(async tx => {
        await lockAdministrator(tx, actorId);
        const user = await tx.user.create({ data: { name: data.name, email: data.email, phone: data.phone, role: "AGENT", accountStatus: "ACTIVE" } });
        const invitation = await tx.invitation.create({ data: { userId: user.id, tokenHash: hashToken(token), createdAt: now, expiresAt } });
        await tx.auditLog.createMany({ data: [
          { actorId, affectedUserId: user.id, action: "AGENT_CREATED", subjectType: "USER", subjectReference: user.id, summary: "Agent account created." },
          { actorId, affectedUserId: user.id, action: "INVITATION_ISSUED", subjectType: "USER", subjectReference: user.id, summary: "Agent activation invitation issued." },
        ] });
        return { id: user.id, name: user.name, email: user.email, phone: user.phone, accountStatus: "ACTIVE" as const,
          createdAt: user.createdAt, updatedAt: user.updatedAt, invitationId: invitation.id };
      }, options);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists.");
      throw error;
    }
    securityEvent("AGENT_INVITATION_CREATED", created.id);
    const delivery = await this.sendInvitation({ id: created.id, name: created.name, email: created.email }, { id: created.invitationId, token, expiresAt });
    return { agent: { id: created.id, name: created.name, email: created.email, phone: created.phone, accountStatus: created.accountStatus,
      passwordActivatedAt: null, invitation: { expiresAt, status: "PENDING" as const }, createdAt: created.createdAt, updatedAt: created.updatedAt }, invitationDelivery: delivery };
  }

  async resendAgentInvitation(actorId: string, id: unknown) {
    const userId = parseInput(agentIdSchema, id);
    const issue = await this.issueInvitation(userId, actorId);
    securityEvent("AGENT_INVITATION_RESENT", userId);
    const delivery = await this.deliverInvitation(issue);
    return { agentId: userId, delivery };
  }

  async acceptInvitation(input: unknown): Promise<void> {
    const data = parseInput(invitationAcceptanceSchema, input);
    const tokenHash = hashToken(data.token);
    const initial = await this.db.invitation.findUnique({ where: { tokenHash } });
    const passwordHash = await hashPassword(data.password);
    const accepted = await this.db.$transaction(async tx => {
      if (!initial) return null;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${initial.userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: initial.userId } });
      const invitation = await tx.invitation.findUnique({ where: { id: initial.id } });
      const now = this.clock();
      if (!user || user.role !== "AGENT" || user.accountStatus !== "ACTIVE" || user.passwordHash !== null || user.passwordActivatedAt !== null ||
        !invitation || invitation.tokenHash !== tokenHash || invitation.revokedAt || invitation.consumedAt || invitation.expiresAt <= now) return null;
      const consumed = await tx.invitation.updateMany({ where: { id: invitation.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) return null;
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordActivatedAt: now } });
      await revokeUserSessions(tx, user.id, now);
      await tx.auditLog.create({ data: { actorId: user.id, affectedUserId: user.id, action: "PASSWORD_ACTIVATED", subjectType: "USER", subjectReference: user.id, summary: "Agent password activated." } });
      return user.id;
    }, options);
    if (!accepted) throw new ApiError(422, "INVALID_OR_EXPIRED_TOKEN", "The invitation is invalid or expired.");
    securityEvent("AGENT_INVITATION_ACCEPTED", accepted);
  }

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
