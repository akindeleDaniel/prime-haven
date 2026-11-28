import type { NextRequest } from "next/server";
import { handleImages } from "@/lib/server/images";
export async function PUT(request: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) { return handleImages(request, "gallery", (await context.params).id); }
