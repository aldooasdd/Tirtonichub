import { requireMedia } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { loadCalendarEvents } from "@/server/calendar-events";
import { studioCalEvents } from "@/server/media/studio-cal-events";
import { KalenderClient } from "@/components/kalender/kalender-client";

export const dynamic = "force-dynamic";

/** Kalender Tirtonichub di dalam Studio: event yang sama dengan Beranda (dibuat/diubah di sini ikut tampil di sana) + jadwal kartu FlowSpace (hanya dibaca). */
export default async function KalenderEmbed() {
  const ctx = await requireMedia();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { fullName: true, branchId: true } });
  const [events, studio] = await Promise.all([
    loadCalendarEvents({ userId: ctx.userId, fullName: user.fullName, branchId: user.branchId }),
    studioCalEvents(),
  ]);
  return (
    <div className="p-4 sm:p-6">
      <KalenderClient events={[...events, ...studio]} studio />
    </div>
  );
}
