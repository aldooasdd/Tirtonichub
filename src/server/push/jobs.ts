// Tugas terjadwal notifikasi Studio. Dijalankan tiap menit oleh src/instrumentation.ts (satu proses server).
import { prisma } from "@/server/db";
import { inMorningWindow, itemsMessage, itemsReady, morningKey, morningPushes, wibKey } from "./logic";
import { sendPush } from "./send";

/** Catat barang Studio BARU (bukan stok lama) ke antrean "Barang masuk". Jangan pernah menggagalkan penyimpanan barang. */
export async function queueNewItem(item: { id: string; name: string; color?: string | null; old?: boolean }) {
  if (item.old) return;
  try {
    await prisma.pushItemQueue.create({ data: { itemId: item.id, name: [item.name, item.color].filter(Boolean).join(" ").slice(0, 200) } });
  } catch (e) {
    console.error("[push] antrean barang", e);
  }
}

const studioUsers = async () =>
  (await prisma.mediaMember.findMany({ where: { user: { isActive: true } }, select: { userId: true } })).map((m) => m.userId);

/** Notifikasi pagi: tiap anggota sekali per hari (PushLog), disusulkan bila server baru menyala sebelum 10.00 WIB. */
export async function runMorning(now = new Date()) {
  if (!inMorningWindow(now)) return;
  const day = wibKey(now);
  const members = await prisma.mediaMember.findMany({
    where: { user: { isActive: true } },
    select: { userId: true, code: true, offDays: true, user: { select: { fullName: true } } },
  });
  const done = new Set(
    (await prisma.pushLog.findMany({ where: { key: { in: members.map((m) => morningKey(day, m.userId)) } }, select: { key: true } })).map((r) => r.key),
  );
  if (members.every((m) => done.has(morningKey(day, m.userId)))) return;
  const tasks = await prisma.mediaTask.findMany({
    where: { status: "Terdata", shootPlan: { not: null, lte: day } },
    select: { type: true, title: true, status: true, shootPlan: true, producer: true, talent: true, script: true, createdAt: true },
  });
  const pushes = morningPushes(
    tasks,
    members.map((m) => ({ userId: m.userId, code: m.code, name: m.user.fullName, offDays: m.offDays })),
    now,
  );
  const byUser = new Map(pushes.map((p) => [p.userId, p]));
  for (const m of members) {
    const key = morningKey(day, m.userId);
    if (done.has(key)) continue;
    // Tandai dulu (kunci unik) baru kirim → walau dua proses jalan bersamaan, hanya satu yang mengirim.
    try {
      await prisma.pushLog.create({ data: { key } });
    } catch {
      continue;
    }
    const p = byUser.get(m.userId);
    if (p) await sendPush([p.userId], { type: "studio_pagi", title: p.title, body: p.body, url: p.url });
  }
}

/** Barang masuk: gabungkan antrean, kirim bila yang tertua sudah ≥ 2 menit. */
export async function runItems(now = new Date()) {
  const queue = await prisma.pushItemQueue.findMany({ where: { sentAt: null }, orderBy: { createdAt: "asc" } });
  if (!itemsReady(queue, now)) return;
  const r = await prisma.pushItemQueue.updateMany({ where: { id: { in: queue.map((q) => q.id) }, sentAt: null }, data: { sentAt: now } });
  if (r.count !== queue.length) return; // diambil proses lain
  const msg = itemsMessage(queue.map((q) => q.name));
  await sendPush(await studioUsers(), { type: "studio_barang", ...msg, url: "/studio/?p=masuk" });
  await prisma.pushItemQueue.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - 30 * 86400_000) } } });
}

export async function pushTick(now = new Date()) {
  for (const job of [runMorning, runItems]) {
    try {
      await job(now);
    } catch (e) {
      console.error("[push]", job.name, e);
    }
  }
}
