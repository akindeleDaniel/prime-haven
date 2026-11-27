import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { prisma } from "../src/db/prisma.js";
import { confirmLocalDevelopmentDatabase } from "../src/db/local.js";
import { AuthService } from "../src/auth/service.js";

let hidden = false;
const terminal = new Writable({ write(chunk, _encoding, callback) {
  if (!hidden) process.stdout.write(chunk);
  callback();
} });

try {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("INTERACTIVE_REQUIRED");
  await confirmLocalDevelopmentDatabase(prisma, process.env.DATABASE_URL!);
  const reader = createInterface({ input: process.stdin, output: terminal, terminal: true });
  try {
    const name = await reader.question("Administrator name: ");
    const email = await reader.question("Administrator email: ");
    const phone = await reader.question("Phone in international format (+234...): ");
    process.stdout.write("Password (hidden, 10+ characters, <=72 UTF-8 bytes): ");
    hidden = true;
    const password = await reader.question("");
    process.stdout.write("\nConfirm password (hidden): ");
    const confirmation = await reader.question("");
    hidden = false;
    process.stdout.write("\n");
    if (confirmation !== password) throw new Error("PASSWORD_MISMATCH");
    const id = await new AuthService(prisma).bootstrap({ name, email, phone, password });
    console.log(`First administrator initialized (${id}). Existing accounts were not replaced.`);
  } finally { hidden = false; reader.close(); }
} catch {
  console.error("Administrator initialization failed or was refused. Use an interactive local terminal, valid fields and a matching password; bootstrap cannot replace an existing administrator.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
