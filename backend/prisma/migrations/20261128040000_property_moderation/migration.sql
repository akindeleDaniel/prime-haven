-- Additive moderation audit vocabulary and oldest-submission queue index.
ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_STATUS_CHANGED';
CREATE INDEX "Property_status_submittedAt_id_idx" ON "Property"("status", "submittedAt", "id");
