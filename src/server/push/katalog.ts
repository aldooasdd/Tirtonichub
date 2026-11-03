// Notifikasi WA "Foto katalog siap" ke Ridho (penerima PUSH_KATALOG_EMAILS, bawaan ridho@tirtonichub.com).
// - Nomor WA dibaca dari MediaMember.phone (kolom "No. WhatsApp" di Tim & Aktivitas Studio). Tidak ada nomor di kode/.env.
// - Pemicu: MediaTask ktl masuk Ready lewat /api/studio/write (store.ts → queueKatalog). Sekali per kartu (ktlNotifAt di extra task).
//   Tidak ada link Drive (dihapus 3 Nov 2026): baris Folder = link folder barang di File Studio (studioFolderLink).
// - Kartu yang Ready dalam 10 menit digabung satu pesan (runKatalog, dijalankan pushTick tiap menit).
// - Kirim dari nomor WA Tirtonichub lewat GOWA (studioWaSend, sama dengan pengirim OTP; STUDIO_WA_VIA=n8n = n8n). Gagal → status kartu tetap, log di KatalogNotif,
//   tanda ktlNotifErr di kartu (admin bisa kirim ulang).
// - Sakelar: MediaSettings.extra.katalogWa (Tim & Aktivitas, admin penuh). Bawaan mati.
import { randomBytes } from "node:crypto";
import type { KatalogNotif, Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { sendPush } from "./send";
import { katalogOnly } from "./logic";
import { studioSender, studioWaSend, waVia } from "./wa";
import { katalogBatchDue, katalogShouldQueue, katalogWaText, maskPhone, studioFolderLink, type KatalogLine } from "./katalog-logic";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function katalogOn(): Promise<boolean> {
  const s = await prisma.mediaSettings.findUnique({ where: { id: 1 }, select: { extra: true } });
  return obj(s?.extra).katalogWa === true;
}

export async function setKatalogOn(on: boolean) {
  const s = await prisma.mediaSettings.findUnique({ where: { id: 1 }, select: { extra: true } });
  const extra = { ...obj(s?.extra), katalogWa: on } as Prisma.InputJsonValue;
  await prisma.mediaSettings.upsert({ where: { id: 1 }, create: { id: 1, extra }, update: { extra } });
  if (!on) await prisma.katalogNotif.deleteMany({ where: { sentAt: null, failedAt: null, batchId: null } }); // antrean dibuang saat dimatikan
}

/** Penerima: akun dengan email PUSH_KATALOG_EMAILS yang terdaftar di Media; nomor dari MediaMember.phone. */
export async function katalogRecipients() {
  const users = await prisma.user.findMany({
    where: { email: { in: katalogOnly() }, isActive: true },
    select: { id: true, email: true, fullName: true, nickname: true, mediaMember: { select: { phone: true, extra: true } } },
  });
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    name: String(obj(u.mediaMember?.extra).name || u.nickname || u.fullName),
    member: !!u.mediaMember,
    phone: u.mediaMember?.phone?.trim() || "",
  }));
}

async function setTaskExtra(taskId: string, patch: Record<string, unknown>) {
  const t = await prisma.mediaTask.findUnique({ where: { id: taskId }, select: { extra: true } });
  if (!t) return;
  const extra = { ...obj(t.extra), ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === null) delete extra[k];
  await prisma.mediaTask.update({ where: { id: taskId }, data: { extra: extra as Prisma.InputJsonValue } });
}

/** Dipanggil store.ts setelah kartu ktl masuk Ready. Tidak pernah menggagalkan penyimpanan kartu. */
export async function queueKatalog(t: { taskId: string; by: string; extra: Record<string, unknown> }) {
  try {
    if (!(await katalogOn()) || !katalogShouldQueue(t.extra)) return;
    const waiting = await prisma.katalogNotif.findFirst({ where: { taskId: t.taskId, sentAt: null, failedAt: null, batchId: null } });
    if (waiting) await prisma.katalogNotif.update({ where: { id: waiting.id }, data: { movedBy: t.by } });
    else await prisma.katalogNotif.create({ data: { taskId: t.taskId, driveUrl: "", movedBy: t.by } });   // kolom driveUrl tidak dipakai lagi
  } catch (e) {
    console.error("[katalog] antrean", e);
  }
}

async function linesOf(rows: Pick<KatalogNotif, "taskId" | "movedBy" | "movedAt">[]): Promise<KatalogLine[]> {
  const tasks = await prisma.mediaTask.findMany({ where: { id: { in: rows.map((r) => r.taskId) } }, select: { id: true, title: true, itemId: true, item: { select: { name: true, color: true, gender: true } } } });
  const T = new Map(tasks.map((t) => [t.id, t]));
  return rows.map((r) => {
    const t = T.get(r.taskId);
    return { name: t?.item?.name || t?.title || "Barang", gender: t?.item?.gender ?? null, color: t?.item?.color ?? null, link: studioFolderLink(t?.item ? t.itemId : null), movedBy: r.movedBy, movedAt: r.movedAt };
  });
}

type SendResult = { ok: boolean; error?: string; sent: number };

/** Kirim teks ke semua penerima yang punya nomor, dari WA Tirtonichub (GOWA). */
async function sendToRecipients(text: string): Promise<SendResult & { recips: Awaited<ReturnType<typeof katalogRecipients>> }> {
  const recips = await katalogRecipients();
  const via = waVia();
  if (!via) return { ok: false, error: process.env.STUDIO_WA_VIA === "n8n" ? "Alamat webhook n8n (N8N_WA_WEBHOOK_URL) belum diisi di server." : "Alamat GOWA (STUDIO_GOWA_URL / GOWA_URL) belum diisi di server.", sent: 0, recips };
  const withPhone = recips.filter((r) => r.phone);
  if (!withPhone.length) return { ok: false, error: recips.some((r) => r.member) ? "Nomor WA penerima belum diisi di Tim & Aktivitas." : "Penerima belum terdaftar di Media (Tim & Aktivitas).", sent: 0, recips };
  let sent = 0;
  for (const r of withPhone) if (await studioWaSend(r.phone, text)) sent++;
  return sent ? { ok: true, sent, recips } : { ok: false, error: (via === "gowa" ? "WA Tirtonichub (GOWA)" : "n8n") + " menolak atau tidak bisa dihubungi.", sent: 0, recips };
}

/** Kirim satu kelompok (sudah diklaim batchId), catat hasil di log + kartu. */
async function deliver(batchId: string, now: Date, notify = true): Promise<SendResult> {
  const rows = await prisma.katalogNotif.findMany({ where: { batchId }, orderBy: { movedAt: "asc" } });
  if (!rows.length) return { ok: false, error: "Antrean kosong.", sent: 0 };
  const lines = await linesOf(rows);
  const r = await sendToRecipients(katalogWaText(lines));
  if (r.ok) {
    await prisma.katalogNotif.updateMany({ where: { batchId }, data: { sentAt: now } });
    for (const x of rows) await setTaskExtra(x.taskId, { ktlNotifAt: now.getTime(), ktlNotifErr: null, ktlNotifWhy: null });
  } else {
    console.error("[katalog] gagal kirim:", r.error);
    await prisma.katalogNotif.updateMany({ where: { batchId }, data: { failedAt: now, error: r.error ?? "gagal" } });
    for (const x of rows) await setTaskExtra(x.taskId, { ktlNotifErr: now.getTime(), ktlNotifWhy: r.error ?? "gagal" });
  }
  // Notifikasi di aplikasi Tirtonichub (lonceng) + push HP untuk penerima yang punya akun (sekali per kelompok; kirim ulang tidak menggandakan).
  const users = notify ? r.recips.map((x) => x.userId) : [];
  if (users.length) {
    const names = lines.map((l) => l.name);
    await sendPush(users, { type: "studio_katalog", title: "📸 Foto katalog siap", body: names.slice(0, 5).join(", ") + (names.length > 5 ? ", …" : ""), url: "/studio/?p=hasil" }, { wa: false }).catch((e) => console.error("[katalog] notifikasi", e));
  }
  return { ok: r.ok, error: r.error, sent: r.sent };
}

const claim = async (ids: string[]) => {
  const batchId = randomBytes(9).toString("base64url");
  const c = await prisma.katalogNotif.updateMany({ where: { id: { in: ids }, batchId: null }, data: { batchId } });
  return c.count === ids.length ? batchId : null;
};

/** Tiap menit: kirim antrean yang tertuanya sudah 10 menit. */
export async function runKatalog(now = new Date()) {
  const pending = await prisma.katalogNotif.findMany({ where: { sentAt: null, failedAt: null, batchId: null }, orderBy: { movedAt: "asc" } });
  if (!katalogBatchDue(pending, now)) return;
  if (!(await katalogOn())) {
    await prisma.katalogNotif.deleteMany({ where: { id: { in: pending.map((p) => p.id) }, batchId: null } });
    return;
  }
  const batchId = await claim(pending.map((p) => p.id));
  if (batchId) await deliver(batchId, now); // null = diambil proses lain
}

/** Admin: kirim ulang kartu yang gagal (langsung, tanpa menunggu 10 menit). */
export async function resendKatalog(taskId: string, by: string): Promise<SendResult> {
  const t = await prisma.mediaTask.findUnique({ where: { id: taskId }, select: { type: true } });
  if (!t || t.type !== "ktl") return { ok: false, error: "Kartu Foto katalog tidak ditemukan.", sent: 0 };
  const last = await prisma.katalogNotif.findFirst({ where: { taskId }, orderBy: { movedAt: "desc" } });
  const row = await prisma.katalogNotif.create({ data: { taskId, driveUrl: "", movedBy: last?.movedBy || by, movedAt: last?.movedAt ?? new Date() } });
  const batchId = await claim([row.id]);
  return batchId ? deliver(batchId, new Date(), false) : { ok: false, error: "Sedang dikirim.", sent: 0 };
}

/** Admin: kirim pesan contoh ke nomor tersimpan (tidak menyentuh kartu). */
export async function testKatalog(by: string): Promise<SendResult> {
  const now = new Date();
  const text = katalogWaText(
    [
      { name: "Contoh Sepatu Tenis A", gender: "men", color: "putih-biru", link: studioFolderLink(null), movedBy: by, movedAt: new Date(now.getTime() - 4 * 60_000) },
      { name: "Contoh Raket B", gender: null, color: "hitam", link: studioFolderLink(null), movedBy: by, movedAt: now },
    ],
    { test: true },
  );
  const r = await sendToRecipients(text);
  if (!r.ok) console.error("[katalog] tes gagal:", r.error);
  return { ok: r.ok, error: r.error, sent: r.sent };
}

/** Ringkasan untuk panel Tim & Aktivitas. */
export async function katalogStatus() {
  const [on, recips, pending, lastFail, sender] = await Promise.all([
    katalogOn(),
    katalogRecipients(),
    prisma.katalogNotif.count({ where: { sentAt: null, failedAt: null } }),
    prisma.katalogNotif.findFirst({ where: { failedAt: { not: null } }, orderBy: { failedAt: "desc" }, select: { failedAt: true, error: true } }),
    studioSender(),
  ]);
  return {
    on,
    via: waVia(),
    sender: { host: sender.host, number: sender.number ? maskPhone(sender.number) : "", ok: sender.ok, error: sender.error ?? "" },
    recipients: recips.map((r) => ({ name: r.name, member: r.member, phone: r.phone ? maskPhone(r.phone) : "" })),
    pending,
    lastFail: lastFail ? { at: lastFail.failedAt!.getTime(), error: lastFail.error ?? "" } : null,
  };
}
