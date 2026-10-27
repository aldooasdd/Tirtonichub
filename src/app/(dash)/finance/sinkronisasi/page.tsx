import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { AccurateSync, type Saved } from "@/components/finance/accurate-sync";

export default async function SinkronisasiPage() {
  await requireFinance();
  const rows = await prisma.accurateCompare.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, createdByName: true, totalAccurate: true, cocokCount: true, selisihCount: true, report: true },
  });
  const saved: Saved[] = rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    by: r.createdByName,
    totalAccurate: r.totalAccurate,
    cocokCount: r.cocokCount,
    selisihCount: r.selisihCount,
    report: r.report as Saved["report"],
  }));
  return <AccurateSync saved={saved} />;
}
