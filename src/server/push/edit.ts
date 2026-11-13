import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma";
import { sendPush } from "./send";
import { EDIT_NOTIF_TYPES, editNotifMsg, nextEditPending, pendingOf, stillSendable } from "./edit-logic";

type Doc = Record<string, unknown>;
const extraOf = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Doc) } : {});

/** Dasbor /media/workflow: tahan WA editor di extra.editNotif (Studio menulisnya langsung di store.ts). */
export async function queueEditNotif(id: string, before: Doc, after: Doc, by: string, actorCode = ""): Promise<void> {
  try {
    const row = await prisma.mediaTask.findUnique({ where: { id }, select: { extra: true } });
    if (!row) return;
    const ex = extraOf(row.extra);
    const p = nextEditPending(ex.editNotif, before, after, by, actorCode);
    if (!p) return;
    ex.editNotif = p;
    await prisma.mediaTask.update({ where: { id }, data: { extra: ex as Prisma.InputJsonValue } });
  } catch (e) {
    console.error("[studio-edit] gagal antre", e);
  }
}

/** Dipanggil pushTick tiap menit: kirim WA + lonceng yang jedanya (15 menit sejak edit terakhir) sudah habis. */
export async function runEditNotif(now = new Date()): Promise<void> {
  const rows = await prisma.mediaTask.findMany({ where: { type: { in: EDIT_NOTIF_TYPES } }, select: { id: true, type: true, title: true, status: true, editor: true, due: true, extra: true } });
  for (const r of rows) {
    const ex = extraOf(r.extra);
    const p = pendingOf(ex.editNotif);
    if (!p || p.due > now.getTime()) continue;
    delete ex.editNotif;
    await prisma.mediaTask.update({ where: { id: r.id }, data: { extra: ex as Prisma.InputJsonValue } });
    const t: Doc = { ...ex, type: r.type, title: r.title, status: r.status, editor: r.editor, due: r.due };
    if (!stillSendable(t)) continue;
    const m = await prisma.mediaMember.findUnique({ where: { code: String(r.editor) }, select: { userId: true } });
    if (m) await sendPush([m.userId], editNotifMsg(p.kind, t, p.by));
  }
}
