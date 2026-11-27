import type { PrismaClient } from "../generated/prisma/client.js";

export async function confirmLocalDevelopmentDatabase(db: PrismaClient, connection: string): Promise<URL> {
  const url = new URL(connection);
  if (process.env.NODE_ENV === "production" || !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["prime_haven_dev", "prime_haven_test"].includes(url.pathname.slice(1)) ||
    [...url.searchParams.keys()].some(key => !["schema", "sslmode"].includes(key))) {
    throw new Error("Refusing operation: only named local Prime Haven development/test databases are permitted.");
  }
  const [actual] = await db.$queryRaw<{ database: string; address: string }[]>`SELECT current_database() AS database, host(inet_server_addr()) AS address`;
  if (!actual || actual.database !== url.pathname.slice(1) || !["127.0.0.1", "::1"].includes(actual.address)) {
    throw new Error("Database server is not confirmed loopback development PostgreSQL.");
  }
  return url;
}
