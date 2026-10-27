"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { hashPassword, verifyPassword, DEFAULT_PASSWORD } from "@/server/auth/password";
import { createSession, destroyCurrentSession, setActiveRole } from "@/server/auth/session";
import { getSession } from "@/server/auth/session";
import { requireAuth } from "@/server/auth/rbac";
import { rateLimit } from "@/server/rate-limit";
import { clientMeta } from "@/server/request-meta";
import { roleCodeSchema } from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string };

/** Login email + password → buat sesi → redirect. Pesan gagal generik. */
export async function loginAction(email: string, password: string): Promise<ActionResult> {
  const { ip } = await clientMeta();
  if (!rateLimit(`login:ip:${ip ?? "x"}`, 10, 60)) {
    return { ok: false, message: "Terlalu banyak percobaan. Coba lagi nanti." };
  }
  const e = emailSchema.safeParse(email);
  if (!e.success || !password) return { ok: false, message: "Email atau password salah." };
  rateLimit(`login:email:${e.data}`, 10, 300);

  const user = await prisma.user.findUnique({ where: { email: e.data } });
  if (!user?.isActive) return { ok: false, message: "Email atau password salah." };

  // Akun lama belum punya password → backfill ke DEFAULT_PASSWORD saat login pertama.
  // Hanya kalau DEFAULT_PASSWORD terisi (biar tak ter-set ke nilai fallback salah).
  // ponytail: shim — sebagian akun sempat ke-set ke fallback "ganti-dulu" saat
  // DEFAULT_PASSWORD belum ada; anggap itu belum ter-set. Hapus setelah semua login.
  let hash = user.passwordHash;
  const corrupt = !!hash && verifyPassword("ganti-dulu", hash);
  if ((!hash || corrupt) && DEFAULT_PASSWORD) {
    hash = hashPassword(DEFAULT_PASSWORD);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  }
  if (!hash || !verifyPassword(password, hash)) {
    return { ok: false, message: "Email atau password salah." };
  }

  const meta = await clientMeta();
  const { activeRole } = await createSession(user.id, meta);
  redirect(activeRole ? "/beranda" : "/pilih-role");
}

/** Ganti password sendiri (dari profil). */
export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const p = passwordSchema.safeParse(next);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Password tidak valid." };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { passwordHash: true } });
  if (!verifyPassword(current, user.passwordHash)) {
    return { ok: false, message: "Password sekarang salah." };
  }
  await prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash: hashPassword(p.data) } });
  return { ok: true, message: "Password berhasil diganti." };
}

/** Pilih/ganti role aktif. */
export async function selectRoleAction(role: string): Promise<ActionResult> {
  const r = roleCodeSchema.safeParse(role);
  if (!r.success) return { ok: false, message: "Role tidak valid." };
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.roles.includes(r.data)) return { ok: false, message: "Kamu tidak punya role ini." };
  await setActiveRole(s.sessionId, r.data);
  redirect("/beranda");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}
