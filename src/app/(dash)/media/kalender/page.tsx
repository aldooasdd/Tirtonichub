import { requireMedia } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { IDX, POSTED, TYPES, makeScheduler, nm } from "@/lib/media/schedule";
import { isExpired } from "@/lib/media/card";
import { loadCtx, todayWIB } from "@/server/media/schedule-runner";
import { MediaKalenderClient, type CalData } from "@/components/media/media-kalender-client";

export default async function MediaKalenderPage() {
  const ctx = await requireMedia();
  const today = todayWIB();
  const [rows, events, schedCtx] = await Promise.all([
    prisma.mediaTask.findMany(),
    prisma.personalCalEvent.findMany({ where: { userId: ctx.userId }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    loadCtx(),
  ]);
  const sch = makeScheduler(schedCtx);
  const tasks = rows.filter((t) => !isExpired({ id: t.id, status: t.status, createdAt: t.createdAt.getTime(), type: t.type, title: t.title }, today));

  const prod = tasks
    .filter((t) => t.shootPlan && IDX[t.status] <= IDX["Diproduksi"])
    .map((t) => ({ date: t.shootPlan!, label: `${nm(t.producer || "")} · ${TYPES[t.type]?.label ?? t.type}`, title: t.title }));

  const post = tasks
    .filter((t) => t.postAt && POSTED.includes(t.type))
    .map((t) => ({
      date: t.postAt!,
      time: t.postTime || sch.timeOf({ id: t.id, type: t.type, status: t.status, postAt: t.postAt, title: t.title }),
      label: TYPES[t.type]?.label ?? t.type,
      title: t.title,
      sched: t.status === "Tayang" || (t.status === "Ready" && !!t.metaAt),
    }));

  const data: CalData = {
    prod,
    post,
    events: events.map((e) => ({ id: e.id, date: e.date, title: e.title, time: e.time, color: e.color, note: e.note })),
  };
  return <MediaKalenderClient data={data} today={today} />;
}
