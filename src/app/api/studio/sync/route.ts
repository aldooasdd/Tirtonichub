import { NextRequest } from "next/server";
import { changes } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";

// Terakhir terlihat per akun (email → ms). UI hanya menarik sinkron saat halaman terbuka & terlihat,
// jadi tarikan terakhir = tanda akun sedang membuka Studio. Disimpan di memori proses (hilang saat server restart).
// "Terakhir online" bertahan lewat Session.lastActiveAt (DB): ditulis paling sering tiap 2 menit per akun,
// dibaca (maks sesi terbaru per akun) paling sering tiap 1 menit.
const g = globalThis as { __studioSeen?: Map<string, number>; __studioSeenDb?: Map<string, number>; __studioLast?: { t: number; m: Record<string, number> } };
const seen = (g.__studioSeen ??= new Map<string, number>());
const wrote = (g.__studioSeenDb ??= new Map<string, number>());
const KEEP_MS = 24 * 3600_000;

async function lastActive(): Promise<Record<string, number>> {
  const c = g.__studioLast;
  if (c && Date.now() - c.t < 60_000) return c.m;
  const rows = await prisma.session.groupBy({ by: ["userId"], _max: { lastActiveAt: true } });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, email: true } });
  const em = new Map(users.map((x) => [x.id, x.email.toLowerCase()]));
  const m: Record<string, number> = {};
  for (const r of rows) {
    const e = em.get(r.userId), t = r._max.lastActiveAt?.getTime();
    if (e && t) m[e] = Math.max(m[e] ?? 0, t);
  }
  g.__studioLast = { t: Date.now(), m };
  return m;
}

// Perubahan sejak `since` (ms). since=0 → semua data yang boleh dibaca.
export async function GET(req: NextRequest) {
  return guarded(async (u) => {
    const now = Date.now();
    seen.set(u.email, now);
    if (now - (wrote.get(u.email) ?? 0) > 120_000) {
      wrote.set(u.email, now);
      getSession()
        .then((s) => s && prisma.session.update({ where: { id: s.sessionId }, data: { lastActiveAt: new Date(now) } }))
        .catch(() => {});
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
