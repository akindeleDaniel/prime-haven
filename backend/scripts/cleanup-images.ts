import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { confirmLocalDevelopmentDatabase } from "../src/db/local.js";
import { ImageService } from "../src/images/service.js";
import { CloudinaryHttpProvider } from "../src/images/cloudinary.js";
try {
  await confirmLocalDevelopmentDatabase(prisma, process.env.DATABASE_URL!);
  if (!process.argv.includes("--execute")) {
    console.log(JSON.stringify({ due: await prisma.cloudinaryAsset.count({ where: { deleteAfter: { lte: new Date() }, image: null } }), executed: false }));
  } else {
    console.log(JSON.stringify(await new ImageService(prisma, new CloudinaryHttpProvider(), process.env.BFF_SHARED_SECRET!).cleanup()));
  }
} catch {
  console.error("Local image cleanup failed; check configuration and retained cleanup state.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
