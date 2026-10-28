import { prisma } from "@/server/db";

export type Buckets = { cash: number; mandiri: number; bca: number; bri: number };
export const zeroBuckets = (): Buckets => ({ cash: 0, mandiri: 0, bca: 0, bri: 0 });

export const BUCKET_LABEL: Record<keyof Buckets, string> = {
  cash: "Cash (laci)",
  mandiri: "EDC Mandiri",
  bca: "EDC BCA",
  bri: "EDC BRI",
};

/** Metode bayar penjualan → penempatan saldo. Selain Mandiri/BCA/BRI dianggap cash. */
export function bucketOf(method: string): keyof Buckets {
  const m = (method || "").toLowerCase();
  if (m.includes("mandiri")) return "mandiri";
  if (m.includes("bca")) return "bca";
  if (m.includes("bri")) return "bri";
  return "cash"; // tunai/cash/lainnya
}

/** Rentang UTC untuk 1 hari WIB (dateKey = UTC midnight tanggal WIB). */
function dayRange(dateKey: Date) {
  const start = new Date(dateKey.getTime() - 7 * 3600_000); // WIB 00:00
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export type CashReport = {
  masuk: Buckets; // penjualan offline per metode (hari itu, cabang itu)
  cashout: number; // total pembelian → keluar dari cash
  expected: Buckets; // saldo seharusnya = saldo awal + masuk − keluar
};

/** Hitung saldo seharusnya dari penjualan offline + pembelian hari itu di cabang. */
export async function computeBranchCash(branchId: string, dateKey: Date, open: Buckets): Promise<CashReport> {
  const { start, end } = dayRange(dateKey);
  const [sales, cashoutAgg] = await Promise.all([
    prisma.salesReport.findMany({
      where: { channel: "offline", branchId, createdAt: { gte: start, lt: end } },
      select: { payments: true },
    }),
    prisma.cashout.aggregate({ where: { branchId, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
  ]);

  const masuk = zeroBuckets();
  for (const s of sales) {
    const pays = (Array.isArray(s.payments) ? s.payments : []) as { method?: string; amount?: number }[];
    for (const p of pays) masuk[bucketOf(p.method ?? "")] += Math.max(0, Math.round(p.amount ?? 0));
  }
  const cashout = cashoutAgg._sum.amount ?? 0;
  const expected: Buckets = {
    cash: open.cash + masuk.cash - cashout,
    mandiri: open.mandiri + masuk.mandiri,
    bca: open.bca + masuk.bca,
    bri: open.bri + masuk.bri,
  };
  return { masuk, cashout, expected };
}
