import type { NextRequest } from "next/server";
import { handleProperties } from "@/lib/server/properties";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return handleProperties(request, "read", (await context.params).id); }
export async function PATCH(request: NextRequest, context: Context) { return handleProperties(request, "edit", (await context.params).id); }
