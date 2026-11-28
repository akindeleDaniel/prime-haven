import type { NextRequest } from "next/server";
import { handleImages } from "@/lib/server/images";
export async function POST(request: NextRequest, context: {
    params: Promise<{
        id: string;
        assetId: string;
    }>;
}) { const { id, assetId } = await context.params; return handleImages(request, "verify", id, assetId); }
