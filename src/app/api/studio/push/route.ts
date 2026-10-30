import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { guarded, ok } from "@/server/studio/http";
import { StudioError } from "@/server/studio/store";
import { pushConfigured, vapidPublicKey } from "@/server/push/send";

// Notifikasi HP/laptop: GET = kunci publik VAPID, POST = simpan langganan perangkat ini, DELETE = hapus.
export async function GET() {
  return guarded(async (u) => {
    const count = await prisma.pushSubscription.count({ where: { userId: u.userId } });
    return ok({ ok: true, enabled: pushConfigured(), publicKey: vapidPublicKey(), devices: count });
  }, { allowUnattended: true });
}

type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; device?: unknown };
const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => null)) as Body | null;
    const endpoint = str(b?.endpoint, 1000);
    const p256dh = str(b?.keys?.p256dh, 200);
    const auth = str(b?.keys?.auth, 100);
    if (!endpoint || !/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new StudioError("invalid-argument", "Data langganan notifikasi tidak valid.");
    const device = str(b?.device, 200);
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: u.userId, endpoint, p256dh, auth, device },
      update: { userId: u.userId, p256dh, auth, device },
    });
    return ok({ ok: true });
  }, { allowUnattended: true });
}

export async function DELETE(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => null)) as Body | null;
    const endpoint = str(b?.endpoint, 1000);
    if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: u.userId } });
    return ok({ ok: true });
  }, { allowUnattended: true });
}
