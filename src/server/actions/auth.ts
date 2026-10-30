"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword, DEFAULT_PASSWORD } from "@/server/auth/password";
import { hashValue, safeEqualHex } from "@/server/auth/hash";
import { sendGowa } from "@/server/wa";
import { createSession, destroyCurrentSession, setActiveRole, revokeAllSessions } from "@/server/auth/session";
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

/** Nomor → bagian nasional (buang 62/0 depan) untuk cocokkan waNumber apa pun formatnya. */
function normalizeNational(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/** Lupa password #1: kirim OTP ke WA (gowa). Pesan selalu generik (anti-enumerasi). */
export async function requestPasswordOtp(waNumber: string): Promise<ActionResult> {
  const { ip } = await clientMeta();
  if (!rateLimit(`otp:ip:${ip ?? "x"}`, 5, 300)) return { ok: false, message: "Terlalu banyak permintaan. Coba lagi nanti." };
  const national = normalizeNational(waNumber);
  if (national.length < 8) return { ok: false, message: "Nomor WA tidak valid." };
  rateLimit(`otp:no:${national}`, 3, 300);

  const user = await prisma.user.findFirst({ where: { isActive: true, waNumber: { contains: national } } });
  if (user) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetCodeHash: hashValue(otp), resetExpiresAt: new Date(Date.now() + 10 * 60_000), resetAttempts: 0 },
    });
    await sendGowa(user.waNumber, `Kode OTP reset password Tirtonichub: ${otp}. Berlaku 10 menit. Jangan bagikan ke siapa pun.`);
  }
  return { ok: true }; // selalu ok: jangan bocorkan apakah nomor terdaftar
}

/** Lupa password #2: verifikasi OTP → set password baru + konfirmasi. Revoke semua sesi. */
export async function resetPasswordWithOtp(waNumber: string, otp: string, newPass: string, confirm: string): Promise<ActionResult> {
  const { ip } = await clientMeta();
  if (!rateLimit(`otpverify:ip:${ip ?? "x"}`, 10, 300)) return { ok: false, message: "Terlalu banyak percobaan. Coba lagi nanti." };
  if (newPass !== confirm) return { ok: false, message: "Konfirmasi password tidak cocok." };
  const p = passwordSchema.safeParse(newPass);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Password tidak valid." };

  const national = normalizeNational(waNumber);
  const code = (otp || "").replace(/\D/g, "");
  const user = await prisma.user.findFirst({ where: { isActive: true, waNumber: { contains: national } } });
  if (!user || !user.resetCodeHash || !user.resetExpiresAt || user.resetExpiresAt < new Date())
    return { ok: false, message: "OTP salah atau kedaluwarsa." };
  if (user.resetAttempts >= 5) return { ok: false, message: "Terlalu banyak percobaan OTP. Minta OTP baru." };
  if (!safeEqualHex(hashValue(code), user.resetCodeHash)) {
    await prisma.user.update({ where: { id: user.id }, data: { resetAttempts: { increment: 1 } } });
    return { ok: false, message: "OTP salah atau kedaluwarsa." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(p.data), resetCodeHash: null, resetExpiresAt: null, resetAttempts: 0 },
  });
  await revokeAllSessions(user.id);
  return { ok: true, message: "Password berhasil diganti. Silakan login." };
}
