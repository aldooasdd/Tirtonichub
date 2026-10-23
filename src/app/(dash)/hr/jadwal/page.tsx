import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { JadwalClient } from "@/components/hr/jadwal-client";

export default async function JadwalPage() {
  await requireHr();
  const schedules = await prisma.workSchedule.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return (
    <JadwalClient
      schedules={schedules.map((s) => ({
        id: s.id,
        name: s.name,
        workDays: s.workDays,
        startTime: s.startTime,
        endTime: s.endTime,
        lateToleranceMin: s.lateToleranceMin,
        userCount: s._count.users,
      }))}
    />
  );
}
