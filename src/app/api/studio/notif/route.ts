import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { guarded, ok } from "@/server/studio/http";

// Notifikasi Tirtonichub (tabel Notification) untuk ikon Notifikasi di kolom ikon Studio.
// GET = jumlah belum dibaca + 30 terbaru milik akun ini. POST {id} = tandai satu dibaca, POST {all:true} = semua dibaca.
export async function GET() {
  return guarded(async (u) => {
    const [unread, rows] = await Promise.all([
      prisma.notification.count({ where: { userId: u.userId, readAt: null } }),
      prisma.notification.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    return ok({
      ok: true,
      unread,
      items: rows.map((n) => ({ id: n.id, title: n.title, body: n.body ?? "", link: n.link ?? "", read: n.readAt != null, at: n.createdAt.getTime() })),
    });
  }, { allowUnattended: true });
}

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => null)) as { id?: unknown; all?: unknown } | null;
    const where = b?.all === true
      ? { userId: u.userId, readAt: null }
      : typeof b?.id === "string" && b.id.length <= 64
        ? { id: b.id, userId: u.userId, readAt: null }
        : null;
    if (where) await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    return ok({ ok: true });
  }, { allowUnattended: true });
}
