import type { NextRequest } from "next/server";
import { handleProperties } from "@/lib/server/properties";
export function GET(request: NextRequest) { return handleProperties(request, "list"); }
export function POST(request: NextRequest) { return handleProperties(request, "create"); }
