import type { NextRequest } from "next/server";
import { handleAuth } from "@/lib/server/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleAuth(request, "resend-invitation", id);
}
