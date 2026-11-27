import bcrypt from "bcryptjs";
import { newPassword, parseInput } from "./validation.js";

export const PASSWORD_COST = 12;
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  parseInput(newPassword, password);
  return bcrypt.hash(password, PASSWORD_COST);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  // Match password work for nonexistent and unactivated accounts as well as known accounts.
  dummyHash ??= bcrypt.hash("dummy-password-not-an-account", PASSWORD_COST);
  const candidate = hash ?? await dummyHash;
  return await bcrypt.compare(password, candidate) && hash !== null;
}
