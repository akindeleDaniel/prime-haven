import type { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { gallerySchema } from "./validation.js";
import type { z } from "zod";

export type Gallery = z.infer<typeof gallerySchema>["gallery"];

// Caller holds the parent Property lock. Cleanup takes the same parent/asset locks.
export async function replaceGallery(tx: Prisma.TransactionClient, propertyId: string, gallery: Gallery, now: Date) {
  const old = await tx.propertyImage.findMany({ where: { propertyId } });
  const desired = new Set(gallery.map(item => item.assetId));
  for (const id of [...new Set([...old.map(item => item.assetId), ...desired])].sort()) {
    await tx.$queryRaw`SELECT id FROM "CloudinaryAsset" WHERE id = ${id}::uuid FOR UPDATE`;
    const asset = await tx.cloudinaryAsset.findUnique({ where: { id } });
    if (!asset || asset.propertyId !== propertyId) throw new ApiError(404, "NOT_FOUND", "Upload not found.");
    if (desired.has(id) && (asset.lifecycle !== "READY" || !asset.verifiedAt)) throw new ApiError(409, "ASSET_UNAVAILABLE", "The upload is unavailable.");
  }
  // Retain presentation identities while avoiding transient order/cover collisions.
  await tx.propertyImage.deleteMany({ where: { propertyId } });
  for (const [index, item] of gallery.entries()) {
    const retained = old.find(image => image.assetId === item.assetId);
    await tx.propertyImage.create({ data: { id: retained?.id, createdAt: retained?.createdAt,
      propertyId, assetId: item.assetId, position: index + 1, isCover: item.isCover,
      caption: item.caption, altText: item.altText ?? item.caption } });
  }
  await tx.cloudinaryAsset.updateMany({ where: { id: { in: old.filter(item => !desired.has(item.assetId)).map(item => item.assetId) } },
    data: { lifecycle: "DELETE_PENDING", deleteAfter: now } });
}
