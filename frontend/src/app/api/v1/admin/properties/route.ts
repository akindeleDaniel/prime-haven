import type { NextRequest } from "next/server";
import { handleProperties } from "@/lib/server/properties";
export async function GET(request: NextRequest) {
  return handleProperties(request, "adminList");
}
