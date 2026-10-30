// Kirim notifikasi push (Web Push/VAPID) + catat di tabel Notification supaya muncul di /notifikasi.
import webpush from "web-push";
import { prisma } from "@/server/db";

let ready: boolean | null = null;
/** Kunci VAPID hanya dari .env server (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT). */
export function pushConfigured(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@tirtonichub.com", pub, priv);
  return (ready = true);
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

export type PushMsg = { type: string; title: string; body?: string; url: string };

/** Kirim ke semua perangkat milik userIds. Langganan yang ditolak (404/410) dihapus. Mengembalikan jumlah perangkat terkirim. */
export async function sendPush(userIds: string[], msg: PushMsg, opts: { record?: boolean } = {}): Promise<number> {
  if (!userIds.length) return 0;
  if (opts.record !== false) {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type: msg.type, title: msg.title, body: msg.body ?? null, link: msg.url })),
    });
  }
  if (!pushConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? "", url: msg.url, tag: msg.type });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: "normal" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
        else console.error("[push] gagal kirim", code ?? e);
      }
    }),
  );
  return sent;
}
