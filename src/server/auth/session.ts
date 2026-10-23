import { cookies } from "next/headers";
import type { RoleCode } from "@prisma/client";
import { prisma } from "@/server/db";
import { hashValue, randomToken } from "./hash";

const COOKIE = "session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 7;
const TTL_MS = TTL_DAYS * 86_400_000;

export type SessionData = {
  sessionId: string;
  user: { id: string; fullName: string; email: string; branchId: string | null };
  roles: RoleCode[];
  activeRole: RoleCode | null;
};

/** Buat sesi untuk user, set cookie. Role aktif = role itu jika cuma 1, else null. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null },
) {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  const codes = roles.map((r) => r.role.code);
  const activeRoleCode = codes.length === 1 ? codes[0] : null;

  const token = randomToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashValue(token),
      activeRoleCode,
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_DAYS * 86_400,
  });

  return { sessionId: session.id, activeRole: activeRoleCode, rolesCount: codes.length };
}

/** Baca sesi dari cookie. Null jika tidak ada / kedaluwarsa / dicabut / user nonaktif. */
export async function getSession(): Promise<SessionData | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const session = await prisma.session.findFirst({
    where: { tokenHash: hashValue(token), revokedAt: null, expiresAt: { gt: now } },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!session || !session.user.isActive) return null;

  // ponytail: sliding expiry di DB, throttle 1 jam. Cookie maxAge diperbarui saat aksi.
  if (now.getTime() - session.lastActiveAt.getTime() > 3_600_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: now, expiresAt: new Date(now.getTime() + TTL_MS) },
    });
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      branchId: session.user.branchId,
    },
    roles: session.user.roles.map((r) => r.role.code),
    activeRole: session.activeRoleCode,
  };
}

/** Set role aktif (harus salah satu role user). Dipanggil dari Server Action. */
export async function setActiveRole(sessionId: string, role: RoleCode) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeRoleCode: role },
  });
}

/** Logout: cabut sesi sekarang + hapus cookie. */
export async function destroyCurrentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashValue(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  (await cookies()).delete(COOKIE);
}

/** Cabut sesi user lain (admin). Caller harus sudah lolos RBAC. */
export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cabut semua sesi aktif seorang user (mis. saat dinonaktifkan). */
export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
