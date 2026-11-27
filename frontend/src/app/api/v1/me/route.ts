import type { NextRequest } from "next/server";
import { handleAuth } from "@/lib/server/auth";

export function GET(request: NextRequest) { return handleAuth(request, "me"); }
