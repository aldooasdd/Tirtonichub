import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

export default async function FinancePembelianPage() {
  await requireFinance();
  // Hanya yang sudah di-ACC Kepala Cabang.
  const rows = await prisma.cashout.findMany({
    where: { approvedAt: { not: null } },
    orderBy: { spentAt: "desc" },
    take: 500,
    include: { createdBy: { select: { fullName: true } } },
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-24 font-semibold">Rekap Pembelian</h1>
        <p className="text-14 text-muted-foreground">Total: <span className="font-semibold text-foreground">{rupiah(total)}</span></p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada pembelian.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b bg-card text-left text-muted-foreground">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Cabang</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3">Oleh</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="p-3 whitespace-nowrap">{fmtWIB(r.spentAt)}</td>
                  <td className="p-3">{r.branchName ?? "-"}</td>
                  <td className="p-3">{r.description}</td>
                  <td className="p-3">{r.createdBy.fullName}</td>
                  <td className="p-3 text-right font-medium whitespace-nowrap">{rupiah(r.amount)}</td>
                  <td className="p-3">
                    {r.photoKey ? (
                      <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-primary">
                        Lihat
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
