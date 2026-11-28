import type { NextRequest } from "next/server";
import { handleAuth } from "@/lib/server/auth";

export function PUT(request: NextRequest) { return handleAuth(request, "change-password"); }
