import { randomInt } from "node:crypto";
import { prisma } from "@/server/db";
import { hashValue, safeEqualHex } from "./hash";

const TTL_MIN = envInt("OTP_TTL_MINUTES", 5);
const MAX_ATTEMPTS = envInt("OTP_MAX_ATTEMPTS", 5);
const LOCK_MIN = envInt("OTP_LOCK_MINUTES", 15);
const MAX_RESEND = envInt("OTP_MAX_RESEND", 3);
const RESEND_COOLDOWN_SEC = envInt("OTP_RESEND_COOLDOWN_SEC", 60);

function envInt(key: string, def: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

function genCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type RequestResult =
  | { ok: true; code: string }
  | { ok: false; reason: "locked" | "too_many_resend" | "cooldown"; until?: Date };

/** Buat atau kirim ulang OTP untuk email. Tidak cek keberadaan user (caller yang cek). */
export async function requestOtp(email: string, ip?: string): Promise<RequestResult> {
  const now = new Date();
  const existing = await prisma.otpChallenge.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return { ok: false, reason: "locked", until: existing.lockedUntil };
  }

  const active =
    existing && !existing.consumedAt && existing.expiresAt > now ? existing : null;

  if (active) {
    if (active.resendCount >= MAX_RESEND) return { ok: false, reason: "too_many_resend" };
    const lastSent = new Date(active.expiresAt.getTime() - TTL_MIN * 60_000);
    const since = (now.getTime() - lastSent.getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SEC) {
      return {
        ok: false,
        reason: "cooldown",
        until: new Date(lastSent.getTime() + RESEND_COOLDOWN_SEC * 1000),
      };
    }
    const code = genCode();
    await prisma.otpChallenge.update({
      where: { id: active.id },
      data: {
        codeHash: hashValue(code),
        expiresAt: new Date(now.getTime() + TTL_MIN * 60_000),
        attempts: 0,
        resendCount: { increment: 1 },
      },
    });
    return { ok: true, code };
  }

  const code = genCode();
  await prisma.otpChallenge.create({
    data: {
      email,
      codeHash: hashValue(code),
      expiresAt: new Date(now.getTime() + TTL_MIN * 60_000),
      ip,
    },
  });
  return { ok: true, code };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "locked" | "no_challenge" };

export async function verifyOtp(email: string, code: string): Promise<VerifyResult> {
  const now = new Date();
  const ch = await prisma.otpChallenge.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!ch) return { ok: false, reason: "no_challenge" };
  if (ch.lockedUntil && ch.lockedUntil > now) return { ok: false, reason: "locked" };
  if (ch.expiresAt < now) return { ok: false, reason: "expired" };

  const match = safeEqualHex(hashValue(code), ch.codeHash);
  const attempts = ch.attempts + 1;

  if (match) {
    await prisma.otpChallenge.update({
      where: { id: ch.id },
      data: { attempts, consumedAt: now },
    });
    return { ok: true };
  }

  const locked = attempts >= MAX_ATTEMPTS;
  await prisma.otpChallenge.update({
    where: { id: ch.id },
    data: {
      attempts,
      lockedUntil: locked ? new Date(now.getTime() + LOCK_MIN * 60_000) : null,
    },
  });
  return { ok: false, reason: locked ? "locked" : "invalid" };
}
