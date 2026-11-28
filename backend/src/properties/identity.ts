import { createHash } from "node:crypto";
export const propertyEtag = (property: { id: string; version: number }): string =>
  `"${createHash("sha256").update(`${property.id}:${property.version}`).digest("hex")}"`;

// Call only at first publication. The sequence-backed reference makes the suffix unique.
export function generatePropertySlug(title: string, reference: string): string {
  if (!/^PH-[0-9]+$/.test(reference)) throw new Error("Invalid property reference.");
  const base = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120).replace(/-$/, "") || "property";
  return `${base}-${reference.slice(3)}`;
}
