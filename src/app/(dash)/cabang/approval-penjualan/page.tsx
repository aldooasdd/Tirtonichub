import { requireHeadBranch } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CabangApproval } from "@/components/sales/cabang-approval";
import { approveBranchSalesReport, rejectBranchSalesReport, REPORT_LABEL, type ReportCategory } from "@/server/actions/sales";

type Item = { name: string; qty: number; price: number; total: number; note: string | null };
type Pay = { method: string; amount: number };

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
    const pays = (Array.isArray(r.payments) ? r.payments : []) as Pay[];
    const wib = new Date(r.soldAt.getTime() + 7 * 3600_000);
    const open = r.reportAt && !r.reportResolvedAt;
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
      report: open
        ? { category: r.reportCategory!, note: r.reportNote || "-", label: REPORT_LABEL[r.reportCategory as ReportCategory] ?? r.reportCategory! }
        : null,
      edit: {
        notaNo: r.notaNo ?? "",
        soldAt: wib.toISOString().slice(0, 16),
        customer: r.customer ?? "",
        salesman: r.salesman ?? "",
        employee: r.employee ?? "",
        subtotal: r.subtotal,
        total: r.total,
        grandTotal: r.grandTotal,
        items: items.map((it) => ({ name: it.name ?? "", qty: it.qty || 1, price: it.price || 0, total: it.total ?? 0, note: it.note ?? null })),
        payments: pays.map((p) => ({ method: p.method || "", amount: p.amount || 0 })),
      },
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
