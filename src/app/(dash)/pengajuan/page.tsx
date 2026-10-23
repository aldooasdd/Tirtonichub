import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { roleAttends } from "@/lib/roles";
import { PengajuanClient } from "@/components/pengajuan/pengajuan-client";

export default async function PengajuanPage() {
  const ctx = await requireAuth();
  if (!roleAttends(ctx.activeRole)) {
    return (
      <div className="rounded-lg bg-card p-6 text-center text-muted-foreground">
        Role Boss tidak mengajukan cuti/izin.
      </div>
    );
  }

  const rows = await prisma.request.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PengajuanClient
      requests={rows.map((r) => ({
        id: r.id,
        type: r.type,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        reason: r.reason,
        status: r.status,
        reviewNote: r.reviewNote,
      }))}
    />
  );
}
