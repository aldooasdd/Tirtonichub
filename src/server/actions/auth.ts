"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { emailSchema, otpSchema } from "@/lib/validation";
import { requestOtp, verifyOtp } from "@/server/auth/otp";
import { createSession, destroyCurrentSession, setActiveRole } from "@/server/auth/session";
import { getSession } from "@/server/auth/session";
import { sendOtp } from "@/server/n8n";
import { rateLimit } from "@/server/rate-limit";
import { clientMeta } from "@/server/request-meta";
import { roleCodeSchema } from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string };

/** Minta/kirim-ulang OTP. Respon SELALU generik (anti enumerasi email). */
export async function requestOtpAction(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(email);
  const { ip } = await clientMeta();

  // rate limit per IP + per email (walau email tak valid, tetap batasi IP)
  if (!rateLimit(`otp:ip:${ip ?? "x"}`, 10, 60)) {
    return { ok: false, message: "Terlalu banyak permintaan. Coba lagi nanti." };
  }
  if (!parsed.success) {
    return { ok: true, message: "Jika email terdaftar, OTP sudah dikirim." };
  }
  const emailValue = parsed.data;
  rateLimit(`otp:email:${emailValue}`, 10, 300);

  const user = await prisma.user.findUnique({ where: { email: emailValue } });
  if (user?.isActive) {
    const res = await requestOtp(emailValue, ip ?? undefined);
    if (res.ok) {
      await sendOtp(user.waNumber, user.email, res.code);
    }
  }
  return { ok: true, message: "Jika email terdaftar, OTP sudah dikirim." };
}

/** Verifikasi OTP → buat sesi → redirect. */
export async function verifyOtpAction(email: string, code: string): Promise<ActionResult> {
  const e = emailSchema.safeParse(email);
  const c = otpSchema.safeParse(code);
  if (!e.success || !c.success) return { ok: false, message: "Kode tidak valid." };

  const res = await verifyOtp(e.data, c.data);
  if (!res.ok) {
    const msg =
      res.reason === "locked"
        ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
        : res.reason === "expired"
          ? "Kode kedaluwarsa. Minta kode baru."
          : "Kode salah.";
    return { ok: false, message: msg };
  }

  const user = await prisma.user.findUnique({ where: { email: e.data } });
  if (!user?.isActive) return { ok: false, message: "Akun tidak aktif." };

  const meta = await clientMeta();
  const { activeRole } = await createSession(user.id, meta);
  redirect(activeRole ? "/beranda" : "/pilih-role");
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
