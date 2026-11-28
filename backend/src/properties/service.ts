import type { PrismaClient, Prisma, NigerianState } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";
import { hashToken, type CurrentUser } from "../auth/service.js";
import { parseInput } from "../auth/validation.js";
import { type Content, contentSchema, contentKeys, missingRequirements, normalizeContent, parseId, parseQuery, writeSchema } from "./validation.js";
import { replaceGallery } from "../images/gallery.js";
import { gallerySchema } from "../images/validation.js";
import { submissionSchema, statusSchema, moderationSchema, parseAdminQuery } from "./validation.js";
import { propertyEtag, generatePropertySlug } from "./identity.js";

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

  private precondition(row: Row, ifMatch?: string) {
    if (!ifMatch) throw new ApiError(428, "PRECONDITION_REQUIRED", "If-Match is required.");
    if (ifMatch !== propertyEtag(row)) throw new ApiError(412, "STALE_RESOURCE", "Read the latest property before changing it.");
  }
  private complete(content: Content, row: Row) {
    const errors = missingRequirements(content).filter(item => item.path !== "gallery");
    const gallery = gallerySchema.safeParse({ gallery: row.images.map(image => ({ assetId: image.assetId,
      caption: image.caption, altText: image.altText, isCover: image.isCover })) });
    if (!gallery.success || row.images.length < 3 || row.images.length > 15 || row.images.filter(image => image.isCover).length !== 1)
      errors.push({ path: "gallery", code: "INVALID_GALLERY", message: "Three to fifteen images and exactly one cover are required." });
    for (const [index, image] of row.images.entries()) {
      if (image.asset.propertyId !== row.id || image.asset.lifecycle !== "READY" || !image.asset.verifiedAt)
        errors.push({ path: `gallery.${index}`, code: "UNVERIFIED_IMAGE", message: "Every image must be verified and scoped to this property." });
    }
    if (errors.length) throw new ApiError(422, "VALIDATION_FAILED", "Complete all submission requirements.", errors);
  }
  private async administratorProperty(tx: Prisma.TransactionClient, actor: CurrentUser, token: string, id: string) {
    await this.agent(tx, actor, token, "ADMINISTRATOR");
    // Lock owner before Property, matching agent/deactivation lock order. Recheck after locking.
    const initial = await tx.property.findUnique({ where: { id }, select: { ownerId: true } });
    if (!initial) throw notFound();
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${initial.ownerId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await tx.property.findUnique({ where: { id }, include });
    if (!row) throw notFound();
    if (row.ownerId !== initial.ownerId) throw new ApiError(409, "STALE_RESOURCE", "Property ownership changed; reload before continuing.");
    return row;
  }
  async submit(actor: CurrentUser, token: string, inputId: unknown, input: unknown, ifMatch?: string) {
    const id = parseId(inputId), data = parseInput(submissionSchema, input);
    const content = normalizeContent({}, data.content);
    return this.db.$transaction(async tx => {
      await this.agent(tx, actor, token);
      const previous = await this.owned(tx, actor.id, id);
      this.precondition(previous, ifMatch);
      if (!["DRAFT", "PUBLISHED", "UNDER_OFFER"].includes(previous.status)) throw new ApiError(409, "INVALID_TRANSITION", "This property cannot be submitted.");
      const errors = missingRequirements(content).filter(item => item.path !== "gallery");
      if (data.gallery.length < 3) errors.push({ path: "gallery", code: "MIN_IMAGES", message: "At least three images are required." });
      if (errors.length) throw new ApiError(422, "VALIDATION_FAILED", "Complete all submission requirements.", errors);
      const amenities = await this.amenities(tx, data.amenityIds, previous.amenities.map(item => item.amenityId));
      await replaceGallery(tx, id, data.gallery, new Date());
      await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
      await tx.propertyAmenity.createMany({ data: amenities.map(item => ({ ...item, propertyId: id })) });
      const oldContent = contentOf(previous);
      const materialFields: (keyof Content)[] = ["priceNaira", "purpose", "propertyType", "state", "city", "neighbourhood", "exactAddress"];
      const clearVerification = materialFields.some(key => oldContent[key] !== content[key]);
      // CompleteSubmission replaces content, including omitted optional fields; never retain old public values accidentally.
      const replacement = { ...Object.fromEntries(contentKeys.map(key => [key, null])), negotiable: false, showExactAddress: true, ...content } as Content;
      const row = await tx.property.update({ where: { id }, data: { ...databaseContent(replacement), status: "PENDING_REVIEW",
        submittedAt: new Date(), rejectionReason: null, featured: false, featuredAt: null, version: { increment: 1 },
        ...(clearVerification ? { verified: false, verifiedById: null, verifiedAt: null } : {}) }, include });
      this.complete(content, row);
      await this.audit(tx, actor.id, row, "PROPERTY_SUBMITTED");
      return projection(row);
    }, options);
  }
  async adminRead(actor: CurrentUser, token: string, inputId: unknown) {
    const id = parseId(inputId);
    return this.db.$transaction(async tx => projection(await this.administratorProperty(tx, actor, token, id)), options);
  }
  async adminList(actor: CurrentUser, token: string, params: URLSearchParams) {
    const query = parseAdminQuery(params);
    return this.db.$transaction(async tx => {
      await this.agent(tx, actor, token, "ADMINISTRATOR");
      const where: Prisma.PropertyWhereInput = { status: query.status, ownerId: query.ownerId,
        ...(query.verified ? { verified: query.verified === "true" } : {}), ...(query.featured ? { featured: query.featured === "true" } : {}) };
      const rows = await tx.property.findMany({ where, include, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        orderBy: query.sort === "submitted_asc" ? [{ submittedAt: { sort: "asc", nulls: "last" } }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "desc" }] });
      const total = await tx.property.count({ where });
      return { data: rows.map(projection), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
    }, { ...options, isolationLevel: "RepeatableRead" });
  }
  async changeStatus(actor: CurrentUser, token: string, inputId: unknown, input: unknown, ifMatch?: string, admin = false) {
    const id = parseId(inputId), data = parseInput(moderationSchema, admin ? input : parseInput(statusSchema, input));
    return this.db.$transaction(async tx => {
      let previous: Row;
      if (admin) previous = await this.administratorProperty(tx, actor, token, id);
      else { await this.agent(tx, actor, token); previous = await this.owned(tx, actor.id, id); }
      this.precondition(previous, ifMatch);
      const from = previous.status, to = data.status;
      const allowed = admin
        ? (from === "PENDING_REVIEW" && ["PUBLISHED", "DRAFT"].includes(to)) || (["PUBLISHED", "UNDER_OFFER"].includes(from) && to === "DRAFT") || (from !== "ARCHIVED" && to === "ARCHIVED") || (from === "ARCHIVED" && to === "DRAFT")
        : (from === "PENDING_REVIEW" && to === "DRAFT") || (from === "PUBLISHED" && to === "UNDER_OFFER") || (from === "UNDER_OFFER" && to === "PUBLISHED") || (["PUBLISHED", "UNDER_OFFER"].includes(from) && to === "CLOSED") || (["DRAFT", "CLOSED"].includes(from) && to === "ARCHIVED");
      if (!allowed) throw new ApiError(409, "INVALID_TRANSITION", "This status transition is not allowed.");
      const requiresReason = admin && to === "DRAFT" && ["PENDING_REVIEW", "PUBLISHED", "UNDER_OFFER"].includes(from);
      if (requiresReason && !data.reason) throw new ApiError(422, "VALIDATION_FAILED", "A rejection or unpublish reason is required.", [{ path: "reason", code: "REQUIRED", message: "Provide a reason." }]);
      if (!requiresReason && data.reason != null) throw new ApiError(422, "VALIDATION_FAILED", "A reason does not apply to this transition.");
      const isPublic = ["PUBLISHED", "UNDER_OFFER"].includes(to);
      if (isPublic) {
        const owner = await tx.user.findUnique({ where: { id: previous.ownerId } });
        if (!owner || owner.role !== "AGENT" || owner.accountStatus !== "ACTIVE" || !owner.passwordActivatedAt || !owner.passwordHash)
          throw new ApiError(409, "OWNER_INELIGIBLE", "An active, activated Agent owner is required.");
        this.complete(normalizeContent({}, contentOf(previous)), previous);
      }
      const row = await tx.property.update({ where: { id }, data: { status: to, version: { increment: 1 },
        archivedAt: to === "ARCHIVED" ? new Date() : null,
        rejectionReason: requiresReason ? data.reason : null,
        ...(!isPublic ? { featured: false, featuredAt: null } : {}),
        ...(isPublic && !previous.publishedAt ? { publishedAt: new Date(), slug: generatePropertySlug(previous.title!, previous.reference) } : {}) }, include });
      await this.audit(tx, actor.id, row, admin && from === "PENDING_REVIEW" ? to === "PUBLISHED" ? "PROPERTY_APPROVED" : to === "DRAFT" ? "PROPERTY_REJECTED" : "PROPERTY_STATUS_CHANGED" : "PROPERTY_STATUS_CHANGED");
      return !admin && to === "ARCHIVED" ? { id: row.id, status: "ARCHIVED" as const } : projection(row);
    }, options);
  }

  private async agent(tx: Prisma.TransactionClient, actor: CurrentUser, token: string, role: "AGENT" | "ADMINISTRATOR" = "AGENT") {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    const session = await tx.session.findUnique({ where: { tokenHash: hashToken(token) } });
    const now = new Date();
    if (!user || user.accountStatus !== "ACTIVE" || !user.passwordActivatedAt || !user.passwordHash ||
      !session || session.userId !== user.id || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
      throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
    }
    if (user.role !== role) throw new ApiError(403, "FORBIDDEN", "This operation requires the appropriate staff role.");
  }
  private async owned(tx: Prisma.TransactionClient, ownerId: string, id: string): Promise<Row> {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${id}::uuid FOR UPDATE`;
    const property = await tx.property.findFirst({ where: { id, ownerId, status: { not: "ARCHIVED" } }, include });
    if (!property) throw notFound();
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
  private async audit(tx: Prisma.TransactionClient, actorId: string, property: { id: string; reference: string }, action: "PROPERTY_CREATED" | "PROPERTY_EDITED" | "PROPERTY_DUPLICATED" | "PROPERTY_SUBMITTED" | "PROPERTY_APPROVED" | "PROPERTY_REJECTED" | "PROPERTY_STATUS_CHANGED") {
    await tx.auditLog.create({ data: { actorId, propertyId: property.id, action, subjectType: "PROPERTY",
      subjectReference: property.reference, summary: { PROPERTY_CREATED: "Property draft created.", PROPERTY_EDITED: "Property content saved.", PROPERTY_DUPLICATED: "Property duplicated as a new draft.", PROPERTY_SUBMITTED: "Property submitted for review.", PROPERTY_APPROVED: "Property approved for publication.", PROPERTY_REJECTED: "Property returned to draft with a reason.", PROPERTY_STATUS_CHANGED: "Property status changed." }[action] } });
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
      const where: Prisma.PropertyWhereInput = { ownerId: actor.id, status: query.status ?? { not: "ARCHIVED" },
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
      if (!["DRAFT", "CLOSED"].includes(previous.status)) throw new ApiError(409, "INVALID_TRANSITION", "This status requires complete submission or withdrawal before editing.");
      if (!ifMatch) throw new ApiError(428, "PRECONDITION_REQUIRED", "If-Match is required.");
      if (ifMatch !== propertyEtag(previous)) throw new ApiError(412, "STALE_RESOURCE", "Read the latest draft before saving.");
      const oldContent = contentOf(previous);
      const content = normalizeContent(oldContent, data.content ?? {});
      if (previous.status === "CLOSED") this.complete(content, previous);
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
