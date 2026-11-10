import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { hashValue, safeEqualHex } from "@/server/auth/hash";

// Sesi mesin kasir /pos: cookie "pos" = "<branchId>.<tanda>". Tanda diturunkan dari hash
// password cabang → ganti password = semua mesin cabang itu otomatis keluar. Tanpa tabel sesi.
const COOKIE = "pos";
const sign = (branchId: string, pwHash: string) => hashValue(`pos:${branchId}:${pwHash}`);

export async function setPosCookie(branchId: string, pwHash: string) {
  (await cookies()).set(COOKIE, `${branchId}.${sign(branchId, pwHash)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
}

export async function clearPosCookie() {
  (await cookies()).delete(COOKIE);
}

/** Cabang mesin ini, atau null bila belum login / password cabang sudah diganti. */
export async function getPosBranch(): Promise<{ id: string; name: string } | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  const [id, tag] = raw?.split(".") ?? [];
  if (!id || !tag || !/^[0-9a-f]{64}$/.test(tag)) return null;
  const b = await prisma.branch.findUnique({ where: { id }, select: { id: true, name: true, posPasswordHash: true } });
  if (!b?.posPasswordHash || !safeEqualHex(tag, sign(b.id, b.posPasswordHash))) return null;
  return { id: b.id, name: b.name };
}

/** "Tirtonic Cabang Jogja" → "JOG". */
export const notaPrefix = (branchName: string) =>
  (branchName.trim().split(/\s+/).pop() ?? "POS").slice(0, 3).toUpperCase();
