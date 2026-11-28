import type { NextRequest } from "next/server";
import { handleProperties } from "@/lib/server/properties";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleProperties(request, "duplicate", (await context.params).id);
}
