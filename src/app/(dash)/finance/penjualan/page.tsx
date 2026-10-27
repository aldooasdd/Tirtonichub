import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { dateKeyWIB } from "@/server/attendance/logic";
import { SalesClient } from "@/components/sales/sales-client";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtDay(key: string) {
  const d = new Date(key + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default async function FinancePenjualanPage() {
  await requireFinance();
  const rows = await prisma.salesReport.findMany({
    orderBy: { soldAt: "desc" },
    take: 500,
    include: { createdBy: { select: { fullName: true } } },
  });

  // kelompokkan per hari (WIB)
  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = dateKeyWIB(r.soldAt).toISOString().slice(0, 10);
    days.set(k, [...(days.get(k) ?? []), r]);
  }

  return (
    <div className="space-y-5">
      <SalesClient reports={[]} canViewAll showList={false} />

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">Belum ada penjualan.</p>
      ) : (
        [...days.entries()].map(([k, list]) => {
          const total = list.reduce((s, r) => s + r.grandTotal, 0);
          return (
            <section key={k} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-16 font-semibold">{fmtDay(k)}</h2>
                <p className="text-14 font-semibold">{rupiah(total)} <span className="text-12 font-normal text-muted-foreground">· {list.length} nota</span></p>
              </div>
              <div className="rounded-lg border bg-card divide-y">
                {list.map((r) => {
                  const items = Array.isArray(r.items) ? (r.items as { name: string }[]) : [];
                  const pays = Array.isArray(r.payments) ? (r.payments as { method: string; amount: number }[]) : [];
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{rupiah(r.grandTotal)}</p>
                        <p className="text-12 text-muted-foreground">
                          {fmtWIB(r.soldAt)}
                          {r.salesman ? ` · ${r.salesman}` : ` · ${r.createdBy.fullName}`}
                          {r.customer ? ` · ${r.customer}` : ""}
                          {r.notaNo ? ` · #${r.notaNo}` : ""}
                        </p>
                        <p className="text-11 text-muted-foreground">
                          {items.map((i) => i.name).filter(Boolean).join(", ") || "-"}
                          {pays.length ? ` — ${pays.map((p) => `${p.method} ${rupiah(p.amount)}`).join(", ")}` : ""}
                        </p>
                      </div>
                      <a
                        href={`/api/file?key=${encodeURIComponent(r.photoKey)}`}
                        target="_blank"
                        rel="noopener"
                        className="shrink-0 text-12 text-primary"
                      >
                        Lihat nota
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
