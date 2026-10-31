import { NextRequest } from "next/server";
import { changes } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// Terakhir terlihat per akun (email → ms). UI hanya menarik sinkron saat halaman terbuka & terlihat,
// jadi tarikan terakhir = tanda akun sedang membuka Studio. Disimpan di memori proses (hilang saat server restart).
const g = globalThis as { __studioSeen?: Map<string, number> };
const seen = (g.__studioSeen ??= new Map<string, number>());
const KEEP_MS = 24 * 3600_000;

// Perubahan sejak `since` (ms). since=0 → semua data yang boleh dibaca.
export async function GET(req: NextRequest) {
  return guarded(async (u) => {
    const now = Date.now();
    seen.set(u.email, now);
    const since = Number(req.nextUrl.searchParams.get("since")) || 0;
    const r = await changes(u, since);
    // Hanya admin penuh (Tim & Aktivitas) yang melihat status online; dikirim sebagai umur (ms) supaya tidak terpengaruh jam perangkat.
    let online: Record<string, number> | undefined;
    if (u.full) {
      online = {};
      for (const [email, t] of seen) {
        if (now - t > KEEP_MS) seen.delete(email);
        else online[email] = now - t;
      }
    }
    return ok({ ok: true, now, ...r, ...(online ? { online } : {}) });
  });
}
