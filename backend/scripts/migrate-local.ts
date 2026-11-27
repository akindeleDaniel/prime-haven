import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/db/prisma.js";
import { confirmLocalDevelopmentDatabase } from "../src/db/local.js";

const execute = promisify(execFile);
try {
  const url = await confirmLocalDevelopmentDatabase(prisma, process.env.DATABASE_URL!);
  if ((url.searchParams.get("schema") ?? "public") !== "public") throw new Error("Local migration command requires the public development schema.");
  const directory = await mkdtemp(join(tmpdir(), "prime-haven-backup-"));
  const backup = join(directory, "before-auth.dump");
  await execute("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", backup,
    "--host", url.hostname.replace(/^\[|\]$/g, ""), "--port", url.port || "5432", "--username", decodeURIComponent(url.username), url.pathname.slice(1)],
    { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: "5" } });
  console.log(`Confirmed local development PostgreSQL; pre-migration backup: ${backup}`);
  await prisma.$disconnect();
  const result = await execute(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env });
  process.stdout.write(result.stdout);
  console.log("Local migration completed without reset.");
} catch {
  // Child-process errors may contain environment/connection arguments. Never print them verbatim.
  console.error("Local migration refused or failed. Check local database eligibility, pg_dump availability and migration history; no reset was attempted.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
