import type { NextRequest } from "next/server";
import { handleProperties } from "@/lib/server/properties";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  return handleProperties(request, "submit", (await context.params).id);
}
