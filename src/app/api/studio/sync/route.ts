import { NextRequest } from "next/server";
import { changes } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";
import { prisma } from "@/server/db";

// Terakhir terlihat per akun (email → ms), HANYA dari Tirtonic Studio. UI menarik sinkron hanya saat halaman Studio
// terbuka & terlihat, jadi tarikan terakhir = tanda akun sedang membuka Studio. Memori proses untuk "Online" (detik),
// MediaMember.lastSeenAt (DB) untuk "Terakhir online" yang bertahan walau server restart: ditulis paling sering
// tiap 2 menit per akun, dibaca paling sering tiap 1 menit.
const g = globalThis as { __studioSeen?: Map<string, number>; __studioSeenDb?: Map<string, number>; __studioLast2?: { t: number; m: Record<string, number> } };
const seen = (g.__studioSeen ??= new Map<string, number>());
const wrote = (g.__studioSeenDb ??= new Map<string, number>());
const KEEP_MS = 24 * 3600_000;

async function lastActive(): Promise<Record<string, number>> {
  const c = g.__studioLast2;
  if (c && Date.now() - c.t < 60_000) return c.m;
  const rows = await prisma.mediaMember.findMany({ where: { lastSeenAt: { not: null } }, select: { lastSeenAt: true, user: { select: { email: true } } } });
  const m: Record<string, number> = {};
  for (const r of rows) if (r.lastSeenAt) m[r.user.email.toLowerCase()] = r.lastSeenAt.getTime();
  g.__studioLast2 = { t: Date.now(), m };
  return m;
}

// Perubahan sejak `since` (ms). since=0 → semua data yang boleh dibaca.
export async function GET(req: NextRequest) {
  return guarded(async (u) => {
    const now = Date.now();
    seen.set(u.email, now);
    if (now - (wrote.get(u.email) ?? 0) > 120_000) {
      wrote.set(u.email, now);
      prisma.mediaMember.updateMany({ where: { userId: u.userId }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
    }
    const since = Number(req.nextUrl.searchParams.get("since")) || 0;
    const r = await changes(u, since);
    // Hanya admin penuh (Tim & Aktivitas) yang melihat status online; dikirim sebagai umur (ms) supaya tidak terpengaruh jam perangkat.
    let online: Record<string, number> | undefined;
    if (u.full) {
      const last: Record<string, number> = { ...(await lastActive().catch(() => ({}))) };
      for (const [email, t] of seen) {
        if (now - t > KEEP_MS) seen.delete(email);
        const e = email.toLowerCase();
        last[e] = Math.max(last[e] ?? 0, t);
      }
      online = {};
      for (const [e, t] of Object.entries(last)) online[e] = Math.max(0, now - t);
    }
    return ok({ ok: true, now, ...r, ...(online ? { online } : {}) });
  });
}
