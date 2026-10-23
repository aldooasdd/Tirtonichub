import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { HariLiburClient } from "@/components/hr/hari-libur-client";

export default async function HariLiburPage() {
  await requireHr();
  const holidays = await prisma.holiday.findMany({ orderBy: { date: "desc" } });
  return (
    <HariLiburClient
      holidays={holidays.map((h) => ({
        id: h.id,
        date: h.date.toISOString().slice(0, 10),
        name: h.name,
      }))}
    />
  );
}
