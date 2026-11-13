import { prisma } from "@/server/db";
import { sendPush } from "./send";
import { editNotifKind, editNotifMsg } from "./edit-logic";

type Doc = Record<string, unknown>;

/** Kirim WA + lonceng ke PIC Editing bila perlu (edit-logic.ts). Tidak pernah melempar error. */
export async function notifyEditor(before: Doc | null, after: Doc, by: string, actorCode = ""): Promise<void> {
  try {
    const kind = editNotifKind(before, after, actorCode);
    if (!kind) return;
    const m = await prisma.mediaMember.findUnique({ where: { code: String(after.editor) }, select: { userId: true } });
    if (!m) return;
    await sendPush([m.userId], editNotifMsg(kind, after, by));
  } catch (e) {
    console.error("[studio-edit] gagal kirim", e);
  }
}
