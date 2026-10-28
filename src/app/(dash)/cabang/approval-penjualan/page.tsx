import { requireHeadBranch } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CabangApproval } from "@/components/sales/cabang-approval";
import { approveBranchSalesReport, rejectBranchSalesReport } from "@/server/actions/sales";

type Item = { name: string; qty: number; price: number; total: number; note: string | null };

export default async function ApprovalPenjualanCabangPage() {
  const ctx = await requireHeadBranch();
  // Nota offline cabang sendiri yang belum di-ACC cabang.
  const rows = await prisma.salesReport.findMany({
    where: {
      channel: "offline",
      branchApprovedAt: null,
      approvedAt: null,
      ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
    },
    orderBy: { createdAt: "desc" },
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
      productPhotoKeys: r.productPhotoKeys,
      items: items.map((it) => ({ name: it.name, qty: it.qty || 1, jual: it.total ?? it.price * (it.qty || 1) })),
    };
  });

  return (
    <CabangApproval
      pending={pending}
      approveFn={approveBranchSalesReport}
      rejectFn={rejectBranchSalesReport}
      title="Approval Penjualan Cabang"
      desc="Setujui penjualan offline cabangmu sebelum lanjut ke Finance."
    />
  );
}
