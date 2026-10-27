import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password awal akun baru (HR create / seed) + backfill akun lama. Nilainya di
// .env server, bukan repo. Kosong → fitur default password nonaktif (tak backfill).
export const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || "";

// Hash password: scrypt (stdlib, no dep). Format "saltHex:hashHex".
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${dk.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const h = Buffer.from(hashHex, "hex");
  const dk = scryptSync(pw, Buffer.from(saltHex, "hex"), h.length);
  return dk.length === h.length && timingSafeEqual(dk, h);
}
