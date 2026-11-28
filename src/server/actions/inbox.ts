"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { kirimMeta } from "@/server/meta-inbox";
import { kirimGowa } from "@/server/gowa-inbox";

/** Balas chat dari Tirtonichub → WA / IG pelanggan. Pesan tersimpan dengan id Meta, jadi echo webhook tidak dobel. */
export async function balasChat(threadId: string, raw: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireChannel();
  const text = raw.trim();
  if (!text) return { ok: false, message: "Pesan kosong." };
  if (text.length > 4000) return { ok: false, message: "Pesan terlalu panjang (maks 4000 huruf)." };
  const t = await prisma.inboxThread.findUnique({ where: { id: threadId } });
  if (!t) return { ok: false, message: "Chat tidak ditemukan." };
  const r = t.accountId.startsWith("gowa:") ? await kirimGowa(t.accountId.slice(5), t.contactId, text) : await kirimMeta(t.channel, t.accountId, t.contactId, text);
  await prisma.inboxMessage.create({ data: { threadId, dir: "out", text, userId: ctx.userId, metaId: r.ok ? r.id : null, error: r.ok ? null : r.error } });
  if (r.ok) await prisma.inboxThread.update({ where: { id: threadId }, data: { lastText: text, lastAt: new Date(), unread: 0 } });
  revalidatePath("/channel/inbox");
  return r.ok ? { ok: true } : { ok: false, message: `Gagal terkirim: ${r.error}` };
}

export async function tandaiDibaca(threadId: string): Promise<void> {
  await requireChannel();
  await prisma.inboxThread.updateMany({ where: { id: threadId, unread: { gt: 0 } }, data: { unread: 0 } });
}
