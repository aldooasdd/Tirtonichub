import { requireHeadBranch } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CabangApproval } from "@/components/sales/cabang-approval";

type Item = { name: string; qty: number; price: number; total: number; note: string | null };

export default async function CabangPenjualanPage() {
  const ctx = await requireHeadBranch();
  const isBoss = ctx.activeRole === "BOSS";
  // Penjualan offline yang belum disetujui; Kepala Cabang = cabangnya saja.
  const rows = await prisma.salesReport.findMany({
    where: {
      channel: "offline",
      approvedAt: null,
      ...(isBoss ? {} : { branchId: ctx.branchId }),
    },
    orderBy: { soldAt: "desc" },
    take: 200,
    include: { createdBy: { select: { fullName: true } } },
  });

  const pending = rows.map((r) => {
    const items = (Array.isArray(r.items) ? r.items : []) as Item[];
    return {
      id: r.id,
      soldAt: fmtWIB(r.soldAt),
      customer: r.customer || "-",
      salesman: r.salesman || "-",
      branch: r.branchName || "-",
      by: r.createdBy.fullName,
      grandTotal: r.grandTotal,
      photoKey: r.photoKey,
      items: items.map((it) => ({
        name: it.name,
        qty: it.qty || 1,
        jual: it.total ?? it.price * (it.qty || 1),
      })),
    };
  });

  return <CabangApproval pending={pending} />;
}
