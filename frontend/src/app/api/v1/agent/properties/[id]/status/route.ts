import type { NextRequest } from "next/server";
import { handleProperties } from "@/lib/server/properties";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  return handleProperties(request, "status", (await context.params).id);
}
