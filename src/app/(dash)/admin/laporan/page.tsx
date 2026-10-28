import { requireReports } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { LaporanInbox } from "@/components/lapor/laporan-inbox";

export default async function LaporanPage() {
  await requireReports();
  const rows = await prisma.report.findMany({
    orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: { createdBy: { select: { fullName: true } } },
  });
  return (
    <LaporanInbox
      reports={rows.map((r) => ({
        id: r.id,
        message: r.message,
        photoKey: r.photoKey,
        by: r.createdBy.fullName,
        at: fmtWIB(r.createdAt),
        resolved: !!r.resolvedAt,
      }))}
    />
  );
}
