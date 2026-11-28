-- CreateEnum
CREATE TYPE "AssetState" AS ENUM ('UPLOADING', 'READY', 'DELETE_PENDING', 'DELETED');

-- CreateTable
CREATE TABLE "CloudinaryAsset" (
    "id" UUID NOT NULL,
    "propertyId" UUID,
    "uploadedById" UUID NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "lifecycle" "AssetState" NOT NULL DEFAULT 'UPLOADING',
    "declaredMimeType" TEXT NOT NULL,
    "declaredByteSize" INTEGER NOT NULL,
    "authorizedUntil" TIMESTAMPTZ(3) NOT NULL,
    "uploadStartedAt" TIMESTAMPTZ(3),
    "uploadedAt" TIMESTAMPTZ(3),
    "contentHash" TEXT,
    "deliveryUrl" TEXT,
    "mimeType" TEXT,
    "format" TEXT,
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "verifiedAt" TIMESTAMPTZ(3),
    "deleteAfter" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CloudinaryAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CloudinaryAsset_declaration" CHECK ("declaredByteSize" BETWEEN 1 AND 5000000 AND "declaredMimeType" IN ('image/jpeg','image/png','image/webp')),
    CONSTRAINT "CloudinaryAsset_expiry" CHECK ("authorizedUntil" > "createdAt" AND "authorizedUntil" <= "createdAt" + INTERVAL '10 minutes'),
    CONSTRAINT "CloudinaryAsset_hash" CHECK ("contentHash" IS NULL OR "contentHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CloudinaryAsset_deleted" CHECK (("lifecycle" = 'DELETED') = ("deletedAt" IS NOT NULL)),
    CONSTRAINT "CloudinaryAsset_ready" CHECK ("lifecycle" <> 'READY' OR (
      "verifiedAt" IS NOT NULL AND "deliveryUrl" IS NOT NULL AND "contentHash" IS NOT NULL
      AND "byteSize" IS NOT NULL AND "byteSize" BETWEEN 1 AND 5000000 AND "width" IS NOT NULL AND "width" > 0
      AND "height" IS NOT NULL AND "height" > 0 AND "format" IS NOT NULL AND "format" IN ('jpg','png','webp')
      AND "mimeType" IS NOT NULL AND (("format"='jpg' AND "mimeType"='image/jpeg') OR ("format"='png' AND "mimeType"='image/png') OR ("format"='webp' AND "mimeType"='image/webp'))))
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "isCover" BOOLEAN NOT NULL,
    "caption" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PropertyImage_position" CHECK ("position" BETWEEN 1 AND 15),
    CONSTRAINT "PropertyImage_text" CHECK (char_length(btrim("caption")) BETWEEN 1 AND 200 AND char_length(btrim("altText")) BETWEEN 1 AND 200)
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudinaryAsset_cloudinaryPublicId_key" ON "CloudinaryAsset"("cloudinaryPublicId");

-- CreateIndex
CREATE INDEX "CloudinaryAsset_lifecycle_deleteAfter_idx" ON "CloudinaryAsset"("lifecycle", "deleteAfter");

-- CreateIndex
CREATE INDEX "CloudinaryAsset_propertyId_idx" ON "CloudinaryAsset"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyImage_assetId_key" ON "PropertyImage"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyImage_propertyId_position_key" ON "PropertyImage"("propertyId", "position");
CREATE UNIQUE INDEX "PropertyImage_one_cover" ON "PropertyImage"("propertyId") WHERE "isCover";

-- AddForeignKey
ALTER TABLE "CloudinaryAsset" ADD CONSTRAINT "CloudinaryAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudinaryAsset" ADD CONSTRAINT "CloudinaryAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CloudinaryAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
