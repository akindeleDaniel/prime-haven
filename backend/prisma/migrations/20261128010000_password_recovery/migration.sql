ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_CHANGED';

CREATE TABLE "PasswordResetToken" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "PasswordResetToken_hash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PasswordResetToken_expiry" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '30 minutes'),
  CONSTRAINT "PasswordResetToken_state" CHECK ("consumedAt" IS NULL OR "revokedAt" IS NULL)
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE UNIQUE INDEX "PasswordResetToken_current_user_key" ON "PasswordResetToken"("userId") WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
