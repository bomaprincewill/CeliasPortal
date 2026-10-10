import { createHmac } from "node:crypto";

// Bind each session to the password used at sign-in without putting its hash
// into the cookie or requiring a database migration.
export function credentialTag(passwordHash: string | null | undefined) {
  if (!passwordHash) return undefined;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required.");
  return createHmac("sha256", secret).update(passwordHash).digest("hex");
}

export function credentialsMatch(tag: unknown, passwordHash: string | null | undefined) {
  return typeof tag === "string" && tag === credentialTag(passwordHash);
}
