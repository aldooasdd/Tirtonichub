import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { isExpired } from "@/lib/media/card";
import { NAMES, PEOPLE, TYPES } from "@/lib/media/schedule";
import { toFsTask, type FsTask, type FsView } from "@/lib/media/flowspace";
import { todayWIB } from "@/server/media/schedule-runner";
import { FlowspaceClient } from "@/components/media/flowspace-client";

/** Dipakai /media/flowspace (dasbor) dan /e/flowspace (tertanam di Studio). */
export async function FlowspaceView() {
  const auth = await requireMedia();
  const acc = await mediaAccess(auth);
  const today = todayWIB();
  const [rows, items, members, saved] = await Promise.all([
    prisma.mediaTask.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.mediaItem.findMany({ select: { id: true, thumb: true } }),
    prisma.mediaMember.findMany({ where: { code: { in: [...PEOPLE] }, user: { isActive: true } }, select: { code: true, user: { select: { nickname: true, fullName: true } } } }),
    prisma.studioDoc.findUnique({ where: { path: "fsviews/" + auth.userId } }),
  ]);
  const thumb = new Map(items.map((i) => [i.id, i.thumb]));
  const tasks: FsTask[] = rows
    .filter((r) => !isExpired({ id: r.id, status: r.status, createdAt: r.createdAt.getTime(), type: r.type, title: r.title }, today))
    .map((r) => toFsTask(r, today, (r.itemId && thumb.get(r.itemId)) || null))
    .filter((t): t is FsTask => !!t);
  const names: Record<string, string> = { ...NAMES };
  for (const m of members) names[m.code] = m.user.nickname || m.user.fullName.split(" ")[0] || NAMES[m.code] || m.code;
  const people = members.map((m) => m.code).sort((a, b) => PEOPLE.indexOf(a as never) - PEOPLE.indexOf(b as never));
  const types = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.label]));
  const views = ((saved?.data as { views?: FsView[] } | null)?.views ?? []) as FsView[];
  return <FlowspaceClient tasks={tasks} names={names} people={people} types={types} today={today} canManage={acc.canManage} full={acc.full} code={acc.code} initialViews={views} />;
}
