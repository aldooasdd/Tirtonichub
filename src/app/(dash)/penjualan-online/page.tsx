import { requireOnlineSales } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CabangApproval } from "@/components/sales/cabang-approval";
import { approveOnlineSales, rejectOnlineSales } from "@/server/actions/sales";

type Item = {
  name: string;
  qty: number;
  price: number;
  total: number;
  note: string | null;
};

export default async function PenjualanOnlinePage() {
  await requireOnlineSales();
  // Penjualan online yang belum disetujui Admin.
  const rows = await prisma.salesReport.findMany({
    where: { channel: "online", approvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { createdBy: { select: { fullName: true } } },
  });

  // Riwayat: 50 penjualan online terakhir yang sudah disetujui (yang ditolak terhapus).
  const done = await prisma.salesReport.findMany({
    where: { channel: "online", approvedAt: { not: null } },
    orderBy: { approvedAt: "desc" },
    take: 50,
    select: {
      id: true,
      soldAt: true,
      customer: true,
      grandTotal: true,
      items: true,
      approvedAt: true,
      approvedById: true,
    },
  });
  const approvers = await prisma.user.findMany({
    where: {
      id: {
        in: [
          ...new Set(
            done.map((d) => d.approvedById).filter((x): x is string => !!x),
          ),
        ],
      },
    },
    select: { id: true, fullName: true },
  });
  const nameOf = new Map(approvers.map((u) => [u.id, u.fullName]));

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
      productPhotoKeys: r.productPhotoKeys,
      items: items.map((it) => ({
        name: it.name,
        qty: it.qty || 1,
        jual: it.total ?? it.price * (it.qty || 1),
      })),
    };
  });

  return (
    <div className="space-y-8">
      <CabangApproval
        pending={pending}
        approveFn={approveOnlineSales}
        rejectFn={rejectOnlineSales}
        title="Approval Penjualan Online"
        desc="Setujui penjualan online dari Sales sebelum masuk Finance."
      />

      <section className="space-y-3">
        <h2 className="text-18 font-semibold">Riwayat disetujui</h2>
        {done.length === 0 ? (
          <p className="text-14 text-muted-foreground">
            Belum ada penjualan online yang disetujui.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-14">
              <thead>
                <tr className="border-b bg-card text-left text-muted-foreground">
                  <th className="p-3">Disetujui</th>
                  <th className="p-3">Tgl jual</th>
                  <th className="p-3">Pelanggan</th>
                  <th className="p-3">Barang</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Oleh</th>
                </tr>
              </thead>
              <tbody>
                {done.map((d) => {
                  const items = (
                    Array.isArray(d.items) ? d.items : []
                  ) as Item[];
                  return (
                    <tr
                      key={d.id}
                      className="border-b last:border-b-0 align-top"
                    >
                      <td className="p-3 whitespace-nowrap">
                        {d.approvedAt ? fmtWIB(d.approvedAt) : "-"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {fmtWIB(d.soldAt)}
                      </td>
                      <td className="p-3">{d.customer || "-"}</td>
                      <td className="p-3">
                        {items
                          .map((it) => `${it.qty || 1}× ${it.name}`)
                          .join(", ") || "-"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        Rp {new Intl.NumberFormat("id-ID").format(d.grandTotal)}
                      </td>
                      <td className="p-3">
                        {(d.approvedById && nameOf.get(d.approvedById)) || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
