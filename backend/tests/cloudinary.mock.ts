import sharp from "sharp";
import { ApiError } from "../src/http/errors.js";
import type { CloudinaryProvider, ProviderMetadata } from "../src/images/cloudinary.js";
export class MockCloudinary implements CloudinaryProvider {
  assets = new Map<string, Buffer>();
  overrides: Partial<ProviderMetadata> = {};
  failDelete = false;
  failUpload = false;
  failInspect = false;
  uploadHook?: () => Promise<void>;
  inspectHook?: () => Promise<void>;
  async upload(publicId: string, bytes: Buffer) {
    await this.uploadHook?.();
    if (this.failUpload) throw new Error("Sensitive provider upload error");
    this.assets.set(publicId, Buffer.from(bytes));
  }
  async inspect(publicId: string): Promise<{ bytes: Buffer; metadata: ProviderMetadata }> {
    await this.inspectHook?.();
    if (this.failInspect) throw new Error("Sensitive provider metadata error");
    const bytes = this.assets.get(publicId);
    if (!bytes) throw new ApiError(409, "UPLOAD_NOT_READY", "Upload not ready.");
    const meta = await sharp(bytes).metadata();
    const format = (meta.format === "jpeg" ? "jpg" : meta.format) as ProviderMetadata["format"];
    return { bytes, metadata: { public_id: publicId, resource_type: "image", type: "upload", format,
      width: meta.width!, height: meta.height!, bytes: bytes.length, version: 1, created_at: new Date().toISOString(),
      secure_url: `https://res.cloudinary.com/mock/image/upload/v1/${publicId}.${format}`, ...this.overrides } };
  }
  async destroy(publicId: string) {
    if (this.failDelete) throw new Error("Sensitive provider deletion error");
    this.assets.delete(publicId);
  }
}
