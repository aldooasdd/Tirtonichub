import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { guarded, ok } from "@/server/studio/http";
import { StudioError } from "@/server/studio/store";
import { USE_PAGES, summarize, isUsePage, wibDay } from "@/lib/media/page-use";

// Pemakaian halaman Studio (23 Nov 2026).
// POST {page} = catat satu kali buka halaman oleh akun yang login (semua anggota Media).
// GET ?days=7|30 = ringkasan per orang × halaman, HANYA admin penuh (Zaki).
export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => null)) as { page?: unknown } | null;
    if (!isUsePage(b?.page)) throw new StudioError("invalid-argument", "Halaman tidak dikenal.");
    const now = new Date();
    const day = wibDay(now.getTime());
    await prisma.studioPageUse.upsert({
      where: { userId_day_page: { userId: u.userId, day, page: b.page } },
      create: { userId: u.userId, day, page: b.page, lastAt: now },
      update: { n: { increment: 1 }, lastAt: now },
    });
    return ok({ ok: true });
  }, { allowUnattended: true });
}

export async function GET(req: NextRequest) {
  return guarded(async (u) => {
    if (!u.full) throw new StudioError("permission-denied", "Hanya admin.");
    const days = req.nextUrl.searchParams.get("days") === "7" ? 7 : 30;
    const since = wibDay(Date.now(), days - 1);
    const [rows, members, first] = await Promise.all([
      prisma.studioPageUse.findMany({ where: { day: { gte: since } } }),
      prisma.mediaMember.findMany({ select: { userId: true, code: true, user: { select: { fullName: true, nickname: true, isActive: true } } } }),
      prisma.studioPageUse.findFirst({ orderBy: { day: "asc" }, select: { day: true } }),
    ]);
    const sum = summarize(rows.map((r) => ({ userId: r.userId, day: r.day, page: r.page, n: r.n, lastAt: r.lastAt.getTime() })));
    const people = members
      .filter((m) => m.user?.isActive !== false)
      .map((m) => ({ userId: m.userId, code: m.code, name: m.user?.nickname || m.user?.fullName || m.code, use: sum[m.userId] ?? {} }));
    return ok({ ok: true, days, since, start: first?.day ?? "", pages: USE_PAGES, people });
  }, { allowUnattended: true });
}
