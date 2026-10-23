import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ApprovalClient } from "@/components/hr/approval-client";

export default async function ApprovalPage() {
  await requireHr();
  const rows = await prisma.request.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { fullName: true } } },
  });
  return (
    <ApprovalClient
      requests={rows.map((r) => ({
        id: r.id,
        userName: r.user.fullName,
        type: r.type,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        reason: r.reason,
      }))}
    />
  );
}
