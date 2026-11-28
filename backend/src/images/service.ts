import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { CurrentUser } from "../auth/service.js";
import { hashToken } from "../auth/service.js";
import { parseInput } from "../auth/validation.js";
import { ApiError } from "../http/errors.js";
import { parseId } from "../properties/validation.js";
import { propertyEtag } from "../properties/identity.js";
import { propertyInclude, propertyProjection } from "../properties/service.js";
import { type CloudinaryProvider, metadataSchema } from "./cloudinary.js";
import { decodeImage, gallerySchema, uploadSchema } from "./validation.js";

const options = { maxWait: 15000, timeout: 15000 };
const DAY = 86400_000;
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const unavailable = () => new ApiError(409, "ASSET_UNAVAILABLE", "The upload is unavailable.");
export class ImageService {
  constructor(private db: PrismaClient, private provider: CloudinaryProvider, private signingKey: string, private clock = () => new Date()) {}

  private async access(tx: Prisma.TransactionClient, actor: CurrentUser, token: string, id: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    const session = await tx.session.findUnique({ where: { tokenHash: hashToken(token) } });
    const now = this.clock();
    if (!user || user.accountStatus !== "ACTIVE" || !user.passwordActivatedAt || !user.passwordHash || !session ||
      session.userId !== user.id || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${id}::uuid FOR UPDATE`;
    const property = await tx.property.findUnique({ where: { id } });
    if (!property || (user.role !== "ADMINISTRATOR" && (user.role !== "AGENT" || property.ownerId !== user.id))) throw new ApiError(404, "NOT_FOUND", "Property not found.");
    if (property.status !== "DRAFT") throw new ApiError(409, "INVALID_TRANSITION", "Image management currently supports Drafts.");
    return property;
  }
  private async asset(tx: Prisma.TransactionClient, id: string, propertyId: string) {
    await tx.$queryRaw`SELECT id FROM "CloudinaryAsset" WHERE id = ${id}::uuid FOR UPDATE`;
    const asset = await tx.cloudinaryAsset.findUnique({ where: { id } });
    if (!asset || asset.propertyId !== propertyId) throw new ApiError(404, "NOT_FOUND", "Upload not found.");
    return asset;
  }
  private signature(id: string, propertyId: string, userId: string, expiresAt: Date) {
    return createHmac("sha256", this.signingKey).update(`property-image:${id}:${propertyId}:${userId}:${expiresAt.toISOString()}`).digest("hex");
  }
  async authorize(actor: CurrentUser, token: string, propertyInput: unknown, input: unknown) {
    const propertyId = parseId(propertyInput);
    const data = parseInput(uploadSchema, input);
    return this.db.$transaction(async tx => {
      await this.access(tx, actor, token, propertyId);
      const now = this.clock();
      const pending = await tx.cloudinaryAsset.count({ where: { propertyId, lifecycle: { in: ["UPLOADING", "READY"] }, image: null, deleteAfter: { gt: now } } });
      if (pending >= 15) throw new ApiError(409, "UPLOAD_LIMIT", "Finish or clean up existing uploads before requesting more.");
      const id = randomUUID(), expiresAt = new Date(now.getTime() + 10 * 60_000);
      await tx.cloudinaryAsset.create({ data: { id, propertyId, uploadedById: actor.id, cloudinaryPublicId: `properties/${propertyId}/${id}`,
        declaredByteSize: data.byteSize, declaredMimeType: data.mimeType, authorizedUntil: expiresAt, createdAt: now, deleteAfter: new Date(now.getTime() + DAY) } });
      return { assetId: id, uploadUrl: `/api/v1/properties/${propertyId}/uploads/${id}/content`, expiresAt,
        parameters: { uploadAuthorization: this.signature(id, propertyId, actor.id, expiresAt) } };
    }, options);
  }
  async upload(actor: CurrentUser, token: string, propertyInput: unknown, assetInput: unknown, authorization: string, bytes: Buffer, mimeType: string) {
    const propertyId = parseId(propertyInput), id = parseId(assetInput);
    const decoded = await decodeImage(bytes);
    const claim = await this.db.$transaction(async tx => {
      await this.access(tx, actor, token, propertyId);
      const asset = await this.asset(tx, id, propertyId);
      const expected = this.signature(id, propertyId, asset.uploadedById, asset.authorizedUntil);
      const supplied = Buffer.from(authorization), expectedBytes = Buffer.from(expected);
      if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes) || asset.uploadedById !== actor.id) throw new ApiError(403, "FORBIDDEN", "Upload authorization is invalid.");
      if (asset.lifecycle !== "UPLOADING" || asset.uploadStartedAt || asset.authorizedUntil <= this.clock()) throw unavailable();
      if (decoded.mimeType !== mimeType || mimeType !== asset.declaredMimeType || bytes.length !== asset.declaredByteSize) throw new ApiError(422, "INVALID_IMAGE", "Image does not match the authorized declaration.");
      return tx.cloudinaryAsset.update({ where: { id }, data: { uploadStartedAt: this.clock(), contentHash: hash(bytes) } });
    }, options);
    try { await this.provider.upload(claim.cloudinaryPublicId, bytes); }
    catch {
      await this.db.cloudinaryAsset.updateMany({ where: { id, lifecycle: "UPLOADING" }, data: { lastErrorCode: "UPLOAD_UNCERTAIN" } });
      throw new ApiError(503, "PROVIDER_UNAVAILABLE", "Upload outcome is uncertain; verify this upload before requesting another.");
    }
    await this.db.cloudinaryAsset.updateMany({ where: { id, lifecycle: "UPLOADING" }, data: { uploadedAt: this.clock(), lastErrorCode: null } });
  }
  async verify(actor: CurrentUser, token: string, propertyInput: unknown, assetInput: unknown) {
    const propertyId = parseId(propertyInput), id = parseId(assetInput);
    const initial = await this.db.$transaction(async tx => {
      await this.access(tx, actor, token, propertyId);
      const asset = await this.asset(tx, id, propertyId);
      if (!["UPLOADING", "READY"].includes(asset.lifecycle) || !asset.uploadStartedAt || !asset.contentHash) throw unavailable();
      return asset;
    }, options);
    if (initial.lifecycle === "READY") return { assetId: id, state: "READY", url: initial.deliveryUrl,
      width: initial.width, height: initial.height, mimeType: initial.mimeType, byteSize: initial.byteSize };
    let verified: Awaited<ReturnType<typeof decodeImage>>, url: string;
    try {
      const received = await this.provider.inspect(initial.cloudinaryPublicId);
      const metadata = metadataSchema.parse(received.metadata);
      verified = await decodeImage(received.bytes); url = metadata.secure_url;
      if (metadata.public_id !== initial.cloudinaryPublicId || hash(received.bytes) !== initial.contentHash ||
        verified.byteSize !== metadata.bytes || verified.width !== metadata.width || verified.height !== metadata.height ||
        verified.format !== metadata.format || verified.mimeType !== initial.declaredMimeType || metadata.bytes !== initial.declaredByteSize) {
        throw new ApiError(422, "INVALID_IMAGE", "Uploaded asset metadata or content is invalid.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) throw error;
      if (error instanceof ApiError && [413, 422].includes(error.status) || error instanceof Error && error.name === "ZodError") {
        await this.db.$transaction(async tx => {
          await this.access(tx, actor, token, propertyId); const asset = await this.asset(tx, id, propertyId);
          if (asset.lifecycle === "UPLOADING") await tx.cloudinaryAsset.update({ where: { id }, data: { lifecycle: "DELETE_PENDING", deleteAfter: this.clock(), lastErrorCode: "INVALID_IMAGE" } });
        }, options);
        throw new ApiError(422, "INVALID_IMAGE", "The uploaded image failed verification.");
      }
      throw new ApiError(503, "PROVIDER_UNAVAILABLE", "Image verification is temporarily unavailable.");
    }
    return this.db.$transaction(async tx => {
      await this.access(tx, actor, token, propertyId); const asset = await this.asset(tx, id, propertyId);
      if (!["UPLOADING", "READY"].includes(asset.lifecycle)) throw unavailable();
      await tx.cloudinaryAsset.update({ where: { id }, data: { lifecycle: "READY", deliveryUrl: url, ...verified, verifiedAt: this.clock(),
        deleteAfter: new Date(this.clock().getTime() + DAY), lastErrorCode: null } });
      return { assetId: id, state: "READY", url, ...verified };
    }, options);
  }
  async gallery(actor: CurrentUser, token: string, propertyInput: unknown, input: unknown, ifMatch?: string) {
    const propertyId = parseId(propertyInput), data = parseInput(gallerySchema, input);
    return this.db.$transaction(async tx => {
      const property = await this.access(tx, actor, token, propertyId);
      if (!ifMatch) throw new ApiError(428, "PRECONDITION_REQUIRED", "If-Match is required.");
      if (ifMatch !== propertyEtag(property)) throw new ApiError(412, "STALE_RESOURCE", "Read the latest property before editing the gallery.");
      const old = await tx.propertyImage.findMany({ where: { propertyId } });
      const desired = new Set(data.gallery.map(item => item.assetId));
      for (const id of [...new Set([...old.map(item => item.assetId), ...desired])].sort()) {
        const asset = await this.asset(tx, id, propertyId);
        if (desired.has(id) && (asset.lifecycle !== "READY" || !asset.verifiedAt)) throw unavailable();
      }
      // Rebuild presentation rows atomically to avoid transient order/cover uniqueness collisions.
      await tx.propertyImage.deleteMany({ where: { propertyId } });
      for (const [index, item] of data.gallery.entries()) await tx.propertyImage.create({ data: {
        id: old.find(image => image.assetId === item.assetId)?.id, createdAt: old.find(image => image.assetId === item.assetId)?.createdAt,
        propertyId, assetId: item.assetId, position: index + 1,
        isCover: item.isCover, caption: item.caption, altText: item.altText ?? item.caption } });
      const removed = old.filter(item => !desired.has(item.assetId)).map(item => item.assetId);
      await tx.cloudinaryAsset.updateMany({ where: { id: { in: removed } }, data: { lifecycle: "DELETE_PENDING", deleteAfter: this.clock() } });
      const row = await tx.property.update({ where: { id: propertyId }, data: { version: { increment: 1 } }, include: propertyInclude });
      await tx.auditLog.create({ data: { actorId: actor.id, propertyId, action: "PROPERTY_EDITED", subjectType: "PROPERTY", subjectReference: property.reference, summary: "Property gallery updated." } });
      return propertyProjection(row);
    }, options);
  }
  async cleanup(limit = 25) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Cleanup batch must be 1-100.");
    const candidates = await this.db.cloudinaryAsset.findMany({ where: { deleteAfter: { lte: this.clock() }, image: null }, orderBy: [{ deleteAfter: "asc" }, { id: "asc" }], take: limit });
    let deleted = 0, failed = 0;
    for (const candidate of candidates) {
      const claimed = await this.db.$transaction(async tx => {
        if (candidate.propertyId) await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${candidate.propertyId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "CloudinaryAsset" WHERE id = ${candidate.id}::uuid FOR UPDATE`;
        const asset = await tx.cloudinaryAsset.findUnique({ where: { id: candidate.id }, include: { image: true } });
        if (!asset || asset.image || !asset.deleteAfter || asset.deleteAfter > this.clock()) return null;
        if (["UPLOADING", "READY"].includes(asset.lifecycle) && asset.authorizedUntil.getTime() + 3600_000 > this.clock().getTime()) return null;
        await tx.cloudinaryAsset.update({ where: { id: asset.id }, data: { lifecycle: "DELETE_PENDING", deletedAt: null } });
        return asset;
      }, options);
      if (!claimed) continue;
      try {
        await this.provider.destroy(claimed.cloudinaryPublicId);
        await this.db.cloudinaryAsset.updateMany({ where: { id: claimed.id, lifecycle: "DELETE_PENDING" }, data: {
          lifecycle: "DELETED", deletedAt: this.clock(), lastErrorCode: null, deleteAfter: new Date(this.clock().getTime() + DAY) } });
        deleted++;
      } catch {
        await this.db.cloudinaryAsset.updateMany({ where: { id: claimed.id, lifecycle: "DELETE_PENDING" }, data: {
          lastErrorCode: "CLOUDINARY_DELETE_FAILED", deleteAfter: new Date(this.clock().getTime() + 300_000) } });
        failed++;
      }
    }
    return { examined: candidates.length, deleted, failed };
  }
}
