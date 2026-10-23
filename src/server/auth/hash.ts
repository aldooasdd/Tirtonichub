import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_SECRET ?? "";
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET wajib di produksi");
}

/** Hash OTP/token dengan pepper AUTH_SECRET. */
export function hashValue(raw: string): string {
  return createHash("sha256").update(`${raw}.${SECRET}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Token sesi acak (dikirim ke cookie; DB simpan hash-nya). */
export function randomToken(): string {
  return randomBytes(32).toString("hex");
}
