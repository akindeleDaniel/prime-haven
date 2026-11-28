import sharp from "sharp";
import { z } from "zod";
import { ApiError } from "../http/errors.js";

export const MAX_IMAGE_BYTES = 5_000_000;
export const mimes = ["image/jpeg", "image/png", "image/webp"] as const;
export const uploadSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(200).refine(value => !/[\u0000-\u001f]/.test(value)),
  byteSize: z.number().int().positive().max(MAX_IMAGE_BYTES),
  mimeType: z.enum(mimes),
});
const descriptive = z.string().trim().min(1).max(200).refine(value =>
  /\p{L}/u.test(value) && !/^(image|photo|picture|img|untitled|test)([\s_-]*\d*)?$/i.test(value) && !/[\u0000-\u001f]/.test(value));
export const gallerySchema = z.strictObject({
  gallery: z.array(z.strictObject({ assetId: z.string().uuid(), caption: descriptive, altText: descriptive.optional(), isCover: z.boolean() }))
    .max(15).refine(items => new Set(items.map(item => item.assetId)).size === items.length)
    .refine(items => items.length === 0 || items.filter(item => item.isCover).length === 1),
});
export async function decodeImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Image size must be between 1 and 5,000,000 bytes.");
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000, pages: -1 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported format");
    // Decode every frame, with a bounded total pixel count, rather than trusting magic bytes.
    await image.raw().toBuffer();
    const height = metadata.pageHeight ?? metadata.height;
    if (!metadata.width || !height) throw new Error("Missing dimensions");
    const format = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    return { format, mimeType: metadata.format === "jpeg" ? "image/jpeg" : `image/${format}`, width: metadata.width, height, byteSize: bytes.length };
  } catch {
    throw new ApiError(422, "INVALID_IMAGE", "Use a valid, decodable JPEG, PNG or WebP image within image processing limits.");
  }
}
