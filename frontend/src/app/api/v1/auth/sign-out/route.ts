import type { NextRequest } from "next/server";
import { handleAuth } from "@/lib/server/auth";

export function POST(request: NextRequest) { return handleAuth(request, "sign-out"); }
