-- Additive authentication slice. Preserve the applied empty initialization migration.
CREATE TYPE "UserRole" AS ENUM ('AGENT', 'ADMINISTRATOR');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoUrl" TEXT,
    "biography" TEXT,
    "passwordHash" TEXT,
    "passwordActivatedAt" TIMESTAMPTZ(3),
    "role" "UserRole" NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_email_normalized" CHECK ("email" = lower(btrim("email")) AND char_length("email") BETWEEN 3 AND 254),
    CONSTRAINT "User_activation_pair" CHECK (("passwordHash" IS NULL) = ("passwordActivatedAt" IS NULL)),
    CONSTRAINT "User_deactivation_pair" CHECK (("accountStatus" = 'ACTIVE' AND "deactivatedAt" IS NULL) OR ("accountStatus" = 'DEACTIVATED' AND "deactivatedAt" IS NOT NULL)),
    CONSTRAINT "User_login_failures" CHECK ("failedLoginCount" BETWEEN 0 AND 5)
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL,
    "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_token_hash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Session_time_bounds" CHECK (
      "createdAt" <= "lastActivityAt" AND "lastActivityAt" < "idleExpiresAt"
      AND "idleExpiresAt" <= "absoluteExpiresAt"
      AND "absoluteExpiresAt" <= "createdAt" + INTERVAL '7 days'
      AND "idleExpiresAt" <= "lastActivityAt" + INTERVAL '12 hours'
    ),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");
