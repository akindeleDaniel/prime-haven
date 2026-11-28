import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../http/errors.js";
import { MAX_IMAGE_BYTES } from "./validation.js";

export const metadataSchema = z.object({
  public_id: z.string(), resource_type: z.literal("image"), type: z.literal("upload"),
  format: z.enum(["jpg", "png", "webp"]), bytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
  width: z.number().int().positive(), height: z.number().int().positive(), version: z.number().int().positive(),
  created_at: z.string().datetime(), secure_url: z.string().url(),
});
export type ProviderMetadata = z.infer<typeof metadataSchema>;
export interface CloudinaryProvider {
  upload(publicId: string, bytes: Buffer): Promise<void>;
  inspect(publicId: string): Promise<{ metadata: ProviderMetadata; bytes: Buffer }>;
  destroy(publicId: string): Promise<void>;
}
function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !key || !secret) throw new Error("Cloudinary is not configured.");
  return { cloud, key, secret, base: `https://api.cloudinary.com/v1_1/${cloud}` };
}
function signed(parameters: Record<string, string>, secret: string) {
  const value = Object.keys(parameters).sort().map(key => `${key}=${parameters[key]}`).join("&");
  return createHash("sha256").update(value + secret).digest("hex");
}
export class CloudinaryHttpProvider implements CloudinaryProvider {
  async upload(publicId: string, bytes: Buffer): Promise<void> {
    const settings = config();
    const parameters = { public_id: publicId, asset_folder: "properties", overwrite: "false", allowed_formats: "jpg,png,webp", timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new FormData();
    for (const [key, value] of Object.entries(parameters)) form.set(key, value);
    form.set("api_key", settings.key); form.set("signature", signed(parameters, settings.secret));
    form.set("file", new Blob([new Uint8Array(bytes)]), "property-image");
    const response = await fetch(settings.base + "/image/upload", { method: "POST", body: form, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Cloudinary upload failed.");
    await response.body?.cancel();
  }
  async inspect(publicId: string) {
    const settings = config();
    const response = await fetch(settings.base + "/resources/image/upload/" + encodeURIComponent(publicId), {
      headers: { Authorization: "Basic " + Buffer.from(settings.key + ":" + settings.secret).toString("base64") },
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) throw new ApiError(409, "UPLOAD_NOT_READY", "Upload is not available for verification.");
    if (!response.ok) throw new Error("Cloudinary metadata unavailable.");
    const metadata = metadataSchema.parse(await response.json());
    const url = `https://res.cloudinary.com/${settings.cloud}/image/upload/v${metadata.version}/${publicId}.${metadata.format}`;
    if (metadata.public_id !== publicId || metadata.secure_url !== url) throw new ApiError(422, "INVALID_IMAGE", "Provider asset identity is invalid.");
    const image = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!image.ok || !image.body) throw new Error("Cloudinary image unavailable.");
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = image.body.getReader();
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new ApiError(422, "INVALID_IMAGE", "Uploaded image is oversized."); }
      chunks.push(chunk.value);
    }
    return { metadata, bytes: Buffer.concat(chunks) };
  }
  async destroy(publicId: string) {
    const settings = config();
    const parameters = { public_id: publicId, invalidate: "true", timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new URLSearchParams({ ...parameters, api_key: settings.key, signature: signed(parameters, settings.secret) });
    const response = await fetch(settings.base + "/image/destroy", { method: "POST", body: form, redirect: "error", signal: AbortSignal.timeout(10000) });
    const json: unknown = await response.json();
    if (!response.ok || !json || typeof json !== "object" || !("result" in json) || !["ok", "not found"].includes(String(json.result))) throw new Error("Cloudinary deletion failed.");
  }
}
