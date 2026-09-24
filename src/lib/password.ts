import { randomBytes, pbkdf2Sync } from "crypto";

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = "sha256";

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return computed === hash;
}
