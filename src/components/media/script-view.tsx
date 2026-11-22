import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { NAMES } from "@/lib/media/schedule";
import { SCRIPT_TYPES, plainText } from "@/lib/media/script";
import { loadScript } from "@/server/actions/script";
import { ScriptClient, type ScriptListRow } from "@/components/media/script-client";

/** Script Konten — dipakai /media/script (dasbor) dan /e/script (tertanam di Studio). ?card=ID membuka script kartu itu. */
export async function ScriptView({ card }: { card?: string }) {
  const auth = await requireMedia();
  const acc = await mediaAccess(auth);
  const [tasks, docs] = await Promise.all([
    prisma.mediaTask.findMany({
      where: { type: { in: [...SCRIPT_TYPES] }, cprId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, title: true, cprId: true, status: true, extra: true, item: { select: { name: true, thumb: true } } },
    }),
    prisma.scriptDoc.findMany({ select: { taskId: true, title: true, status: true, updatedAt: true, content: true } }),
  ]);
  const byTask = new Map(docs.map((d) => [d.taskId, d]));
  const rows: ScriptListRow[] = tasks
    .filter((t) => {
      const ex = (t.extra ?? {}) as Record<string, unknown>;
      return !ex.mergedInto && (!ex.suspendedAt || byTask.has(t.id));
    })
    .map((t) => {
      const d = byTask.get(t.id);
      const ex = (t.extra ?? {}) as Record<string, unknown>;
      return {
        taskId: t.id, type: t.type, title: t.title, cprId: t.cprId || "", stage: t.status, item: t.item?.name || "", thumb: t.item?.thumb || null,
        campaignId: typeof ex.campaignId === "string" ? ex.campaignId : "",
        doc: d ? { title: d.title, status: d.status, updatedAt: d.updatedAt.getTime(), text: plainText(d.content, 600) } : null,
      };
    });
  const first = card ? await loadScript(card) : null;
  return <ScriptClient rows={rows} initial={first && first.ok ? first.data : null} initialCard={card || ""} me={auth.userId} canManage={acc.canManage} full={acc.full} people={NAMES} />;
}
