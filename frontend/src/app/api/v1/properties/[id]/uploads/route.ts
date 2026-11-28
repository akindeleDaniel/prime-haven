import type { NextRequest } from "next/server";
import { handleImages } from "@/lib/server/images";
export async function POST(request: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) { return handleImages(request, "authorize", (await context.params).id); }
