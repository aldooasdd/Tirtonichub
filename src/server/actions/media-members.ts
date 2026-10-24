"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import type { MediaRole } from "@/generated/prisma";

export type ActionResult = { ok: boolean; message?: string };

const ROLES: MediaRole[] = ["ADMIN", "ADMIN2", "MEMBER"];

/** Buat/ubah data anggota media (hanya admin penuh). */
export async function upsertMember(
  userId: string,
  f: { code: string; role: MediaRole; idcc: boolean; offDays: number[]; phone?: string | null },
): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.full) return { ok: false, message: "Hanya admin penuh." };

  const code = f.code.trim().toUpperCase().slice(0, 4);
  if (!code) return { ok: false, message: "Kode wajib diisi (mis. Z, R, A, S)." };
  if (!ROLES.includes(f.role)) return { ok: false, message: "Role tidak valid." };
  const offDays = [...new Set((f.offDays || []).filter((d) => d >= 0 && d <= 6))];

  // kode harus unik antar anggota
  const clash = await prisma.mediaMember.findFirst({ where: { code, userId: { not: userId } } });
  if (clash) return { ok: false, message: `Kode "${code}" sudah dipakai anggota lain.` };
  // pastikan user memang punya role MEDIA
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roles: { select: { role: { select: { code: true } } } } } });
  if (!user) return { ok: false, message: "User tidak ditemukan." };
  if (!user.roles.some((r) => r.role.code === "MEDIA")) return { ok: false, message: "User ini bukan anggota Media." };

  await prisma.mediaMember.upsert({
    where: { userId },
    update: { code, role: f.role, idcc: f.idcc, offDays, phone: f.phone?.trim() || null },
    create: { userId, code, role: f.role, idcc: f.idcc, offDays, phone: f.phone?.trim() || null },
  });
  return { ok: true };
}

/** Hapus data anggota media (hanya admin penuh). */
export async function removeMember(userId: string): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.full) return { ok: false, message: "Hanya admin penuh." };
  await prisma.mediaMember.deleteMany({ where: { userId } });
  return { ok: true };
}
