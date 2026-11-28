import type { PrismaClient, Prisma, NigerianState } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { hashToken, type CurrentUser } from "../auth/service.js";
import { parseInput } from "../auth/validation.js";
import { type Content, contentSchema, contentKeys, missingRequirements, normalizeContent, parseId, parseQuery, writeSchema } from "./validation.js";
import { propertyEtag } from "./identity.js";

export const propertyInclude = { amenities: { include: { amenity: true } }, images: { include: { asset: true }, orderBy: { position: "asc" as const } } } as const;
const include = propertyInclude;
type Row = Prisma.PropertyGetPayload<{ include: typeof include }>;
const options = { maxWait: 15000, timeout: 15000 };
const notFound = () => new ApiError(404, "NOT_FOUND", "Property not found.");
function contentOf(row: Row): Content {
  const values = Object.fromEntries(contentKeys.map(key => [key, row[key]]));
  values.priceNaira = row.priceNaira?.toString() ?? null;
  values.floorAreaSqm = row.floorAreaSqm?.toString() ?? null;
  values.plotSizeSqm = row.plotSizeSqm?.toString() ?? null;
  values.state = row.state?.replaceAll("_", " ") ?? null;
  return parseInput(contentSchema, values);
}
function databaseContent(content: Content) {
  const { priceNaira, state, ...rest } = content;
  return { ...rest, priceNaira: priceNaira == null ? priceNaira : BigInt(priceNaira),
    state: state == null ? state : state.replaceAll(" ", "_") as NigerianState };
}
export function propertyProjection(row: Row) {
  const content = contentOf(row);
  return { id: row.id, ownerId: row.ownerId, reference: row.reference, version: row.version, etag: propertyEtag(row),
    status: row.status, content, gallery: row.images.map(image => ({ id: image.id, assetId: image.assetId, url: image.asset.deliveryUrl,
      width: image.asset.width, height: image.asset.height, position: image.position, isCover: image.isCover, caption: image.caption, altText: image.altText })),
    amenityIds: row.amenities.map(item => item.amenityId),
    amenities: row.amenities.map(({ amenity }) => ({ id: amenity.id, name: amenity.name, isActive: amenity.isActive })),
    slug: row.slug, publishedAt: row.publishedAt, submittedAt: row.submittedAt, archivedAt: row.archivedAt,
    rejectionReason: row.rejectionReason, verified: row.verified, verifiedById: row.verifiedById, verifiedAt: row.verifiedAt,
    featured: row.featured, featuredAt: row.featuredAt, viewCount: "0", createdAt: row.createdAt, updatedAt: row.updatedAt,
    missingRequirements: missingRequirements(content).filter(field => field.path !== "gallery" || row.images.length < 3 || !row.images.some(image => image.isCover)) };
}
const projection = propertyProjection;

export class PropertyService {
  constructor(private db: PrismaClient) {}

  private async agent(tx: Prisma.TransactionClient, actor: CurrentUser, token: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    const session = await tx.session.findUnique({ where: { tokenHash: hashToken(token) } });
    const now = new Date();
    if (!user || user.accountStatus !== "ACTIVE" || !user.passwordActivatedAt || !user.passwordHash ||
      !session || session.userId !== user.id || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
      throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
    }
    if (user.role !== "AGENT") throw new ApiError(403, "FORBIDDEN", "An Agent account is required.");
  }
  private async owned(tx: Prisma.TransactionClient, ownerId: string, id: string): Promise<Row> {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${id}::uuid FOR UPDATE`;
    const property = await tx.property.findFirst({ where: { id, ownerId, status: { not: "ARCHIVED" } }, include });
    if (!property) throw notFound();
    if (property.status !== "DRAFT") throw new ApiError(409, "INVALID_TRANSITION", "Only drafts are supported by this operation.");
    return property;
  }
  private async amenities(tx: Prisma.TransactionClient, ids: string[], retained: string[] = []) {
    // Stable row locks serialize selection against future amenity deactivation.
    const rows = [];
    for (const id of [...ids].sort()) {
      await tx.$queryRaw`SELECT id FROM "Amenity" WHERE id = ${id}::uuid FOR SHARE`;
      const row = await tx.amenity.findUnique({ where: { id } });
      if (!row || (!row.isActive && !retained.includes(id))) throw new ApiError(422, "VALIDATION_FAILED", "Select existing active amenities.");
      rows.push({ amenityId: id });
    }
    return rows;
  }
  private async audit(tx: Prisma.TransactionClient, actorId: string, property: { id: string; reference: string }, action: "PROPERTY_CREATED" | "PROPERTY_EDITED" | "PROPERTY_DUPLICATED") {
    await tx.auditLog.create({ data: { actorId, propertyId: property.id, action, subjectType: "PROPERTY",
      subjectReference: property.reference, summary: action === "PROPERTY_EDITED" ? "Property draft saved." : action === "PROPERTY_CREATED" ? "Property draft created." : "Property duplicated as a new draft." } });
  }
  async create(actor: CurrentUser, token: string, input: unknown) {
    const data = parseInput(writeSchema, input);
    const content = normalizeContent({}, data.content ?? {});
    return this.db.$transaction(async tx => {
      await this.agent(tx, actor, token);
      const amenities = await this.amenities(tx, data.amenityIds ?? []);
      const property = await tx.property.create({ data: { ...databaseContent(content), ownerId: actor.id, amenities: { create: amenities } }, include });
      await this.audit(tx, actor.id, property, "PROPERTY_CREATED");
      return projection(property);
    }, options);
  }
  async read(actor: CurrentUser, token: string, inputId: unknown) {
    const id = parseId(inputId);
    return this.db.$transaction(async tx => { await this.agent(tx, actor, token); return projection(await this.owned(tx, actor.id, id)); }, options);
  }
  async list(actor: CurrentUser, token: string, params: URLSearchParams) {
    const query = parseQuery(params);
    return this.db.$transaction(async tx => {
      await this.agent(tx, actor, token);
      const where: Prisma.PropertyWhereInput = { ownerId: actor.id, status: "DRAFT",
        ...(query.status && query.status !== "DRAFT" ? { id: { in: [] } } : {}),
        ...(query.rejectedOnly === "true" ? { rejectionReason: { not: null } } : {}) };
      const [rows, total] = await Promise.all([
        tx.property.findMany({ where, include, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
          orderBy: query.sort === "created_desc" ? [{ createdAt: "desc" }, { id: "desc" }] : [{ updatedAt: "desc" }, { id: "desc" }] }),
        tx.property.count({ where }),
      ]);
      return { data: rows.map(projection), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
    }, options);
  }
  async edit(actor: CurrentUser, token: string, inputId: unknown, input: unknown, ifMatch?: string) {
    const id = parseId(inputId);
    const data = parseInput(writeSchema, input);
    return this.db.$transaction(async tx => {
      await this.agent(tx, actor, token);
      const previous = await this.owned(tx, actor.id, id);
      if (!ifMatch) throw new ApiError(428, "PRECONDITION_REQUIRED", "If-Match is required.");
      if (ifMatch !== propertyEtag(previous)) throw new ApiError(412, "STALE_RESOURCE", "Read the latest draft before saving.");
      const oldContent = contentOf(previous);
      const content = normalizeContent(oldContent, data.content ?? {});
      const materialFields: (keyof Content)[] = ["priceNaira", "purpose", "propertyType", "state", "city", "neighbourhood", "exactAddress"];
      const clearVerification = materialFields.some(key => oldContent[key] !== content[key]);
      if (data.amenityIds) {
        const amenities = await this.amenities(tx, data.amenityIds, previous.amenities.map(item => item.amenityId));
        await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
        await tx.propertyAmenity.createMany({ data: amenities.map(item => ({ ...item, propertyId: id })) });
      }
      const property = await tx.property.update({ where: { id }, data: { ...databaseContent(content), version: { increment: 1 },
        ...(clearVerification ? { verified: false, verifiedById: null, verifiedAt: null } : {}) }, include });
      await this.audit(tx, actor.id, property, "PROPERTY_EDITED");
      return projection(property);
    }, options);
  }
  async duplicate(actor: CurrentUser, token: string, inputId: unknown) {
    const id = parseId(inputId);
    return this.db.$transaction(async tx => {
      await this.agent(tx, actor, token);
      const source = await this.owned(tx, actor.id, id);
      const amenities = await this.amenities(tx, source.amenities.map(item => item.amenityId), source.amenities.map(item => item.amenityId));
      const property = await tx.property.create({ data: { ...databaseContent(contentOf(source)), ownerId: actor.id, amenities: { create: amenities } }, include });
      await this.audit(tx, actor.id, property, "PROPERTY_DUPLICATED");
      return projection(property);
    }, options);
  }
}
