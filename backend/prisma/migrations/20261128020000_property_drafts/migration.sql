CREATE SEQUENCE property_reference_seq START 1;
CREATE FUNCTION next_property_reference() RETURNS TEXT LANGUAGE SQL AS $$
  SELECT 'PH-' || lpad(n::text, greatest(6, length(n::text)), '0') FROM nextval('property_reference_seq') AS n
$$;

-- CreateEnum
CREATE TYPE "PropertyPurpose" AS ENUM ('FOR_SALE', 'FOR_RENT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT_FLAT', 'DUPLEX', 'TERRACE', 'LAND', 'COMMERCIAL', 'OFFICE', 'SHOP');

-- CreateEnum
CREATE TYPE "RentPeriod" AS ENUM ('PER_YEAR', 'PER_MONTH');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'UNDER_OFFER', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NigerianState" AS ENUM ('Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_EDITED';
ALTER TYPE "AuditAction" ADD VALUE 'PROPERTY_DUPLICATED';

-- AlterEnum
ALTER TYPE "AuditSubjectType" ADD VALUE 'PROPERTY';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "propertyId" UUID;

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "reference" TEXT NOT NULL DEFAULT next_property_reference(),
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "description" TEXT,
    "purpose" "PropertyPurpose",
    "propertyType" "PropertyType",
    "priceNaira" BIGINT,
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "state" "NigerianState",
    "city" TEXT,
    "neighbourhood" TEXT,
    "exactAddress" TEXT,
    "showExactAddress" BOOLEAN NOT NULL DEFAULT true,
    "rentPeriod" "RentPeriod",
    "furnishing" "Furnishing",
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "toilets" INTEGER,
    "parkingSpaces" INTEGER,
    "floorAreaSqm" DECIMAL(12,2),
    "plotSizeSqm" DECIMAL(12,2),
    "titleDocumentType" TEXT,
    "slug" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "submittedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMPTZ(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Property_version" CHECK ("version" > 0),
    CONSTRAINT "Property_title" CHECK ("title" IS NULL OR char_length("title") BETWEEN 10 AND 120),
    CONSTRAINT "Property_description" CHECK ("description" IS NULL OR char_length("description") BETWEEN 50 AND 5000),
    CONSTRAINT "Property_price" CHECK ("priceNaira" IS NULL OR "priceNaira" > 0),
    CONSTRAINT "Property_location_text" CHECK (
      ("city" IS NULL OR char_length("city") BETWEEN 1 AND 120) AND
      ("neighbourhood" IS NULL OR char_length("neighbourhood") BETWEEN 1 AND 120) AND
      ("exactAddress" IS NULL OR char_length("exactAddress") BETWEEN 1 AND 300)),
    CONSTRAINT "Property_counts" CHECK (
      ("bedrooms" IS NULL OR "bedrooms" BETWEEN 0 AND 20) AND
      ("bathrooms" IS NULL OR "bathrooms" BETWEEN 0 AND 20) AND
      ("toilets" IS NULL OR "toilets" BETWEEN 0 AND 20) AND
      ("parkingSpaces" IS NULL OR "parkingSpaces" >= 0)),
    CONSTRAINT "Property_areas" CHECK (("floorAreaSqm" IS NULL OR "floorAreaSqm" > 0) AND ("plotSizeSqm" IS NULL OR "plotSizeSqm" > 0)),
    CONSTRAINT "Property_title_document" CHECK ("titleDocumentType" IS NULL OR char_length("titleDocumentType") BETWEEN 1 AND 120),
    CONSTRAINT "Property_sale_period" CHECK ("purpose" IS DISTINCT FROM 'FOR_SALE' OR "rentPeriod" IS NULL),
    CONSTRAINT "Property_type_fields" CHECK (
      "propertyType" IS NULL OR
      ("propertyType" IN ('HOUSE','APARTMENT_FLAT','DUPLEX','TERRACE') AND "plotSizeSqm" IS NULL AND "titleDocumentType" IS NULL) OR
      ("propertyType" = 'LAND' AND "bedrooms" IS NULL AND "bathrooms" IS NULL AND "toilets" IS NULL AND "furnishing" IS NULL AND "parkingSpaces" IS NULL AND "floorAreaSqm" IS NULL) OR
      ("propertyType" IN ('COMMERCIAL','OFFICE','SHOP') AND "bedrooms" IS NULL AND "bathrooms" IS NULL AND "toilets" IS NULL AND "furnishing" IS NULL AND "plotSizeSqm" IS NULL AND "titleDocumentType" IS NULL)),
    CONSTRAINT "Property_publication" CHECK (("slug" IS NULL) = ("publishedAt" IS NULL)),
    CONSTRAINT "Property_public_identity" CHECK ("status" NOT IN ('PUBLISHED','UNDER_OFFER','CLOSED') OR ("slug" IS NOT NULL AND "publishedAt" IS NOT NULL)),
    CONSTRAINT "Property_archive" CHECK (("status" = 'ARCHIVED') = ("archivedAt" IS NOT NULL)),
    CONSTRAINT "Property_submission" CHECK ("status" <> 'PENDING_REVIEW' OR "submittedAt" IS NOT NULL),
    CONSTRAINT "Property_verification" CHECK (
      ("verified" AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL) OR
      (NOT "verified" AND "verifiedById" IS NULL AND "verifiedAt" IS NULL)),
    CONSTRAINT "Property_feature" CHECK (
      ("featured" AND "featuredAt" IS NOT NULL AND "status" IN ('PUBLISHED','UNDER_OFFER')) OR
      (NOT "featured" AND "featuredAt" IS NULL)),
    CONSTRAINT "Property_complete_content" CHECK (
      "status" NOT IN ('PENDING_REVIEW','PUBLISHED','UNDER_OFFER','CLOSED') OR
      ("title" IS NOT NULL AND "description" IS NOT NULL AND "purpose" IS NOT NULL AND "propertyType" IS NOT NULL
       AND "priceNaira" IS NOT NULL AND "state" IS NOT NULL AND "city" IS NOT NULL AND "neighbourhood" IS NOT NULL AND "exactAddress" IS NOT NULL
       AND ("purpose" <> 'FOR_RENT' OR "rentPeriod" IS NOT NULL)
       AND (("propertyType" = 'LAND' AND "plotSizeSqm" IS NOT NULL AND "titleDocumentType" IS NOT NULL)
         OR ("propertyType" IN ('HOUSE','APARTMENT_FLAT','DUPLEX','TERRACE') AND "bedrooms" IS NOT NULL AND "bathrooms" IS NOT NULL AND "toilets" IS NOT NULL AND "furnishing" IS NOT NULL AND "parkingSpaces" IS NOT NULL)
         OR ("propertyType" IN ('COMMERCIAL','OFFICE','SHOP') AND "floorAreaSqm" IS NOT NULL AND "parkingSpaces" IS NOT NULL))))
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAmenity" (
    "propertyId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_reference_key" ON "Property"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE INDEX "Property_ownerId_status_updatedAt_id_idx" ON "Property"("ownerId", "status", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_name_key" ON "Amenity"("name");

-- CreateIndex
CREATE INDEX "PropertyAmenity_amenityId_propertyId_idx" ON "PropertyAmenity"("amenityId", "propertyId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
