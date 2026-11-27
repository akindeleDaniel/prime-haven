CREATE TYPE "InvitationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "AuditAction" AS ENUM ('AGENT_CREATED', 'INVITATION_ISSUED', 'PASSWORD_ACTIVATED');
CREATE TYPE "AuditSubjectType" AS ENUM ('USER', 'SECURITY');

CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "deliveryStatus" "InvitationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invitation_token_hash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Invitation_expiration" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '48 hours'),
    CONSTRAINT "Invitation_consumed_revoked" CHECK ("consumedAt" IS NULL OR "revokedAt" IS NULL),
    CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_userId_revokedAt_consumedAt_idx" ON "Invitation"("userId", "revokedAt", "consumedAt");
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "affectedUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "subjectType" "AuditSubjectType" NOT NULL,
    "subjectReference" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditLog_subject_reference" CHECK (char_length("subjectReference") BETWEEN 1 AND 160),
    CONSTRAINT "AuditLog_summary" CHECK (char_length("summary") BETWEEN 1 AND 500),
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_affectedUserId_fkey" FOREIGN KEY ("affectedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_affectedUserId_createdAt_idx" ON "AuditLog"("affectedUserId", "createdAt");
