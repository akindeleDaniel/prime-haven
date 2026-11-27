import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set before creating PrismaClient.");
}

export function createDatabaseClient(url: string): PrismaClient {
  const parsed = new URL(url);
  const schema = parsed.searchParams.get("schema") ?? "public";
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error("Invalid database schema name.");
  parsed.searchParams.delete("schema");
  const adapter = new PrismaPg({ connectionString: parsed.toString(), options: `-c search_path=${schema} -c timezone=UTC` }, { schema });
  return new PrismaClient({ adapter });
}

export const prisma = createDatabaseClient(databaseUrl);
