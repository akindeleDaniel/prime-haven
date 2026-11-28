import { z } from "zod";
import { ApiError } from "../http/errors.js";
import { parseInput } from "../auth/validation.js";

export const states = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"] as const;
const text = (min: number, max: number) => z.string().trim().transform(value => value === "" ? null : value)
  .pipe(z.string().min(min).max(max).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Unsupported control characters.").nullable());
const count = z.number().int().min(0).max(20).nullable();
const area = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).refine(value => Number(value) > 0 && Number(value) <= 9999999999.99).nullable();
export const contentSchema = z.strictObject({
  title: text(10, 120).nullable().optional(),
  description: text(50, 5000).nullable().optional(),
  purpose: z.enum(["FOR_SALE", "FOR_RENT"]).nullable().optional(),
  propertyType: z.enum(["HOUSE", "APARTMENT_FLAT", "DUPLEX", "TERRACE", "LAND", "COMMERCIAL", "OFFICE", "SHOP"]).nullable().optional(),
  priceNaira: z.string().regex(/^[1-9]\d{0,18}$/).refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n).nullable().optional(),
  negotiable: z.boolean().optional(),
  state: z.enum(states).nullable().optional(),
  city: text(1, 120).nullable().optional(),
  neighbourhood: text(1, 120).nullable().optional(),
  exactAddress: text(1, 300).nullable().optional(),
  showExactAddress: z.boolean().optional(),
  rentPeriod: z.enum(["PER_YEAR", "PER_MONTH"]).nullable().optional(),
  furnishing: z.enum(["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"]).nullable().optional(),
  bedrooms: count.optional(), bathrooms: count.optional(), toilets: count.optional(),
  parkingSpaces: z.number().int().min(0).max(2147483647).nullable().optional(),
  floorAreaSqm: area.optional(), plotSizeSqm: area.optional(),
  titleDocumentType: text(1, 120).nullable().optional(),
});
export type Content = z.infer<typeof contentSchema>;
export const writeSchema = z.strictObject({
  content: contentSchema.optional(),
  amenityIds: z.array(z.string().uuid()).max(200).refine(values => new Set(values).size === values.length).optional(),
});
export const contentKeys = Object.keys(contentSchema.shape) as (keyof Content)[];
export const residential = ["HOUSE", "APARTMENT_FLAT", "DUPLEX", "TERRACE"];

export function normalizeContent(previous: Content, patch: Content): Content {
  const merged = { ...previous, ...patch };
  const irrelevant: (keyof Content)[] = [];
  if (merged.propertyType === "LAND") irrelevant.push("bedrooms", "bathrooms", "toilets", "furnishing", "parkingSpaces", "floorAreaSqm");
  else if (merged.propertyType && residential.includes(merged.propertyType)) irrelevant.push("plotSizeSqm", "titleDocumentType");
  else if (merged.propertyType) irrelevant.push("bedrooms", "bathrooms", "toilets", "furnishing", "plotSizeSqm", "titleDocumentType");
  if (merged.purpose === "FOR_SALE") irrelevant.push("rentPeriod");
  for (const field of irrelevant) {
    if (patch[field] != null) throw new ApiError(422, "VALIDATION_FAILED", "A field does not apply to the selected property type or purpose.", [{ path: `content.${field}`, code: "INAPPLICABLE", message: "This field does not apply." }]);
    Object.assign(merged, { [field]: null });
  }
  return merged;
}

export function parseId(input: unknown): string {
  const result = z.string().uuid().safeParse(input);
  if (!result.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid property identifier.");
  return result.data;
}

const integer = (max: number) => z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value)) && Number(value) <= max).transform(Number);
const querySchema = z.strictObject({
  page: integer(1000000).default(1), pageSize: integer(50).default(20),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "UNDER_OFFER", "CLOSED"]).optional(),
  rejectedOnly: z.enum(["true", "false"]).optional(),
  sort: z.enum(["updated_desc", "created_desc"]).default("updated_desc"),
});
export function parseQuery(params: URLSearchParams) {
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in values) throw new ApiError(400, "INVALID_REQUEST", "Repeated query parameter.");
    values[key] = value;
  }
  return parseInput(querySchema, values);
}

export function missingRequirements(content: Content) {
  const required: (keyof Content)[] = ["title", "description", "purpose", "propertyType", "priceNaira", "state", "city", "neighbourhood", "exactAddress"];
  if (content.purpose === "FOR_RENT") required.push("rentPeriod");
  if (content.propertyType === "LAND") required.push("plotSizeSqm", "titleDocumentType");
  else if (content.propertyType && residential.includes(content.propertyType)) required.push("bedrooms", "bathrooms", "toilets", "furnishing", "parkingSpaces");
  else if (content.propertyType) required.push("floorAreaSqm", "parkingSpaces");
  return [...required.filter(field => content[field] == null).map(field => ({ path: `content.${field}`, code: "REQUIRED", message: "This field is required before submission." })),
    { path: "gallery", code: "MIN_IMAGES", message: "At least three images and one cover are required before submission." }];
}
