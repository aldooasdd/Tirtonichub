import { requireOnlineSales } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CabangApproval } from "@/components/sales/cabang-approval";
import { approveOnlineSales, rejectOnlineSales } from "@/server/actions/sales";

type Item = { name: string; qty: number; price: number; total: number; note: string | null };

export default async function PenjualanOnlinePage() {
  await requireOnlineSales();
  // Penjualan online yang belum disetujui Admin.
  const rows = await prisma.salesReport.findMany({
    where: { channel: "online", approvedAt: null },
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
      branch: "Online",
      by: r.createdBy.fullName,
      grandTotal: r.grandTotal,
      photoKey: r.photoKey,
      items: items.map((it) => ({ name: it.name, qty: it.qty || 1, jual: it.total ?? it.price * (it.qty || 1) })),
    };
  });

  return (
    <CabangApproval
      pending={pending}
      approveFn={approveOnlineSales}
      rejectFn={rejectOnlineSales}
      title="Approval Penjualan Online"
      desc="Setujui penjualan online dari Sales sebelum masuk Finance."
    />
  );
}
