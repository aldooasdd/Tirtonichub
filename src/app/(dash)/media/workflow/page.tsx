import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { makeScheduler } from "@/lib/media/schedule";
import { isExpired } from "@/lib/media/card";
import { loadCtx, todayWIB, runBalance } from "@/server/media/schedule-runner";
import { WorkflowClient, type WfTask } from "@/components/media/workflow-client";

export default async function WorkflowPage() {
  const authCtx = await requireMedia();
  const acc = await mediaAccess(authCtx);
  // penyeimbang jalan saat buka papan (geser jadwal lewat/penuh)
  if (acc.canManage) await runBalance().catch(() => {});

  const today = todayWIB();
  const [rows, items, ctx] = await Promise.all([
    prisma.mediaTask.findMany({ orderBy: [{ shootPlan: "asc" }, { createdAt: "asc" }] }),
    prisma.mediaItem.findMany({ select: { id: true, gender: true, thumb: true } }),
    loadCtx(),
  ]);
  const sch = makeScheduler(ctx);
  const gender = new Map(items.map((i) => [i.id, i.gender]));

  const tasks: WfTask[] = rows
    .map((t) => ({
      id: t.id,
      itemId: t.itemId,
      type: t.type,
      title: t.title,
      cat: t.cat,
      gender: (t.itemId && gender.get(t.itemId)) || null,
      status: t.status,
      source: t.source,
      reason: t.reason,
      producer: t.producer,
      editor: t.editor,
      talent: t.talent,
      script: t.script,
      shootPlan: t.shootPlan,
      editPlan: t.editPlan,
      postAt: t.postAt,
      postTime: t.postTime,
      postTimeAuto: sch.timeOf({ id: t.id, type: t.type, status: t.status, postAt: t.postAt, title: t.title }),
      due: t.due,
      shotAt: t.shotAt,
      readyAt: t.readyAt,
      locked: t.locked,
      checked: t.checked,
      meta: !!t.metaAt,
      driveUrl: t.driveUrl,
      caption: t.caption,
      srcDesc: t.srcDesc,
      note: t.note,
      fileDue: sch.fileDue({ id: t.id, type: t.type, status: t.status, postAt: t.postAt, title: t.title, itemId: t.itemId, source: t.source }),
      history: (t.history as { at: number; name?: string; from?: string; to?: string }[]) ?? [],
      createdAt: t.createdAt.getTime(),
    }))
    .filter((t) => !isExpired({ id: t.id, status: t.status, createdAt: t.createdAt, type: t.type, title: t.title }, today));

  return <WorkflowClient tasks={tasks} canManage={acc.canManage} code={acc.code} today={today} />;
}
