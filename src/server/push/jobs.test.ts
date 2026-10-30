// Uji kirim-sekali & gabungan barang masuk ke database sungguhan. Dilewati bila DB tidak bisa dihubungi.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/server/db";
import { queueNewItem, runItems, runMorning } from "./jobs";

// Hanya DB lokal (jangan pernah menyentuh antrean/notifikasi asli), dan tanpa kirim push sungguhan.
delete process.env.VAPID_PRIVATE_KEY;
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL ?? "");

let member: { userId: string } | null = null;
before(async () => {
  if (!local) return;
  const reachable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  member = reachable ? await prisma.mediaMember.findFirst({ where: { code: "Z", user: { isActive: true } }, select: { userId: true } }) : null;
});

// Jumat 4 Jan 2030 (jauh di depan supaya tidak bentrok dengan data asli)
const DAY = "2030-01-04";
const AT = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+07:00`);
const TAG = "__uji_push__";

after(async () => {
  if (!member) return;
  await prisma.mediaTask.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.pushLog.deleteMany({ where: { key: { startsWith: `pagi:${DAY}:` } } });
  await prisma.notification.deleteMany({ where: { OR: [{ body: { contains: TAG } }, { title: { contains: TAG } }] } });
  await prisma.pushItemQueue.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

test("notifikasi pagi hanya sekali per orang per hari, susulan sampai 10.00", async (t) => {
  if (!member) return t.skip("DB lokal / anggota Z tidak tersedia");
  await prisma.mediaTask.create({
    data: { type: "igf", title: `${TAG} sepatu`, status: "Terdata", producer: "Z", shootPlan: DAY, createdAt: new Date(`${DAY}T01:00:00+07:00`) },
  });
  const count = () => prisma.notification.count({ where: { userId: member!.userId, type: "studio_pagi", body: { contains: TAG } } });
  await runMorning(AT("06:59"));
  assert.equal(await count(), 0, "sebelum 07.00 belum dikirim");
  await runMorning(AT("08:30")); // server baru menyala 08.30 → susulan
  await runMorning(AT("08:31"));
  await Promise.all([runMorning(AT("09:00")), runMorning(AT("09:00"))]); // dua proses bersamaan
  assert.equal(await count(), 1);
});

test("barang masuk berdekatan jadi satu notifikasi", async (t) => {
  if (!member) return t.skip("DB lokal / anggota Z tidak tersedia");
  await prisma.pushItemQueue.deleteMany({ where: { sentAt: null } });
  await queueNewItem({ id: "x1", name: `${TAG} Asics`, color: "putih" });
  await queueNewItem({ id: "x2", name: `${TAG} Yonex`, color: "biru" });
  await queueNewItem({ id: "x3", name: `${TAG} Stok lama`, old: true });
  const count = () => prisma.notification.count({ where: { userId: member!.userId, type: "studio_barang", body: { contains: TAG } } });
  await runItems(new Date());
  assert.equal(await count(), 0, "belum 2 menit");
  const later = new Date(Date.now() + 121_000);
  await runItems(later);
  await runItems(later);
  assert.equal(await count(), 1);
  const n = await prisma.notification.findFirst({ where: { userId: member!.userId, type: "studio_barang", body: { contains: TAG } } });
  assert.equal(n?.title, "2 barang masuk");
  assert.equal(n?.link, "/studio/?p=masuk");
});
