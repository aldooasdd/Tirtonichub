"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { kirimMeta } from "@/server/meta-inbox";
import { kirimGowa } from "@/server/gowa-inbox";
import { makeKey, putObject } from "@/server/storage";

const FOTO = ["image/jpeg", "image/png"];
const base = () => (process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "");

/** Balas chat dari Inbox (FormData: threadId, text, dm=1, foto). Pesan tersimpan dengan id Meta/GOWA, jadi echo webhook tidak dobel. */
export async function balasChat(fd: FormData): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireChannel();
  const threadId = String(fd.get("threadId") ?? "");
  const text = String(fd.get("text") ?? "").trim();
  const dm = fd.get("dm") === "1";
  const file = fd.get("foto");
  const foto = file instanceof File && file.size ? file : null;
  if (!text && !foto) return { ok: false, message: "Pesan kosong." };
  if (text.length > 4000) return { ok: false, message: "Pesan terlalu panjang (maks 4000 huruf)." };
  if (foto && (!FOTO.includes(foto.type) || foto.size > 8_000_000)) return { ok: false, message: "Foto harus JPG/PNG, maks 8 MB." };
  const t = await prisma.inboxThread.findUnique({ where: { id: threadId } });
  if (!t) return { ok: false, message: "Chat tidak ditemukan." };

  let mediaUrl: string | null = null;
  const buf = foto ? Buffer.from(await foto.arrayBuffer()) : null;
  if (foto && buf) {
    const key = makeKey("inbox", foto.type === "image/png" ? "png" : "jpg");
    await putObject(key, buf, foto.type);
    mediaUrl = `${base()}/api/file?key=${encodeURIComponent(key)}`;
  }
  // komentar IG: balas komentar terakhir pelanggan di chat ini
  const commentId = t.channel === "IGK" ? (await prisma.inboxMessage.findFirst({ where: { threadId, dir: "in", metaId: { startsWith: "c:" } }, orderBy: { at: "desc" }, select: { metaId: true } }))?.metaId?.slice(2) : undefined;

  const r = t.accountId.startsWith("gowa:")
    ? await kirimGowa(t.accountId.slice(5), t.contactId, text, foto && buf ? { buf, name: foto.name || "foto.jpg", type: foto.type } : undefined)
    : mediaUrl && text && t.channel !== "IGK"
      ? // IG/FB: foto & teks dikirim sebagai 2 pesan
        await kirimMeta(t.channel, t.accountId, t.contactId, "", { foto: mediaUrl }).then(async (a) => (a.ok ? kirimMeta(t.channel, t.accountId, t.contactId, text) : a))
      : await kirimMeta(t.channel, t.accountId, t.contactId, text, { foto: mediaUrl ?? undefined, commentId, dm });
  const label = `${t.channel === "IGK" ? (dm ? "[DM] " : "[Balasan komentar] ") : ""}${text || "[Foto]"}`;
  await prisma.inboxMessage.create({ data: { threadId, dir: "out", text: label, mediaUrl, userId: ctx.userId, metaId: r.ok ? r.id : null, error: r.ok ? null : r.error } });
  if (r.ok) await prisma.inboxThread.update({ where: { id: threadId }, data: { lastText: label, lastAt: new Date(), unread: 0 } });
  revalidatePath("/channel/inbox");
  return r.ok ? { ok: true } : { ok: false, message: `Gagal terkirim: ${r.error}` };
}

export async function tandaiDibaca(threadId: string): Promise<void> {
  await requireChannel();
  await prisma.inboxThread.updateMany({ where: { id: threadId, unread: { gt: 0 } }, data: { unread: 0 } });
}

// --- Template balasan & Auto DM komentar (halaman Inbox → Otomatis) ---
export async function simpanTemplate(fd: FormData): Promise<void> {
  await requireChannel();
  const judul = String(fd.get("judul") ?? "").trim();
  const teks = String(fd.get("teks") ?? "").trim();
  if (judul && teks) await prisma.inboxTemplate.create({ data: { judul: judul.slice(0, 60), teks: teks.slice(0, 2000) } });
  revalidatePath("/channel/inbox", "layout");
}

export async function hapusTemplate(fd: FormData): Promise<void> {
  await requireChannel();
  await prisma.inboxTemplate.deleteMany({ where: { id: String(fd.get("id")) } });
  revalidatePath("/channel/inbox", "layout");
}

export async function simpanAuto(fd: FormData): Promise<void> {
  await requireChannel();
  const keyword = String(fd.get("keyword") ?? "").trim();
  const balasan = String(fd.get("balasan") ?? "").trim();
  if (keyword && balasan) await prisma.inboxAuto.create({ data: { keyword: keyword.slice(0, 200), balasan: balasan.slice(0, 1000) } });
  revalidatePath("/channel/inbox", "layout");
}

export async function aturAuto(fd: FormData): Promise<void> {
  await requireChannel();
  const id = String(fd.get("id"));
  if (fd.get("hapus")) await prisma.inboxAuto.deleteMany({ where: { id } });
  else await prisma.inboxAuto.updateMany({ where: { id }, data: { aktif: fd.get("aktif") === "1" } });
  revalidatePath("/channel/inbox", "layout");
}
