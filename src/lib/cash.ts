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

export type BranchCashBoardData = {
  branch: { id: string; name: string };
  opened: boolean;
  open: Buckets;
  report: CashReport;
  close: Buckets | null;
};

/** Muat saldo kasir semua cabang (Office disembunyikan) untuk dateKey. Dipakai dashboard Finance. */
export async function loadBranchCashBoards(dateKey: Date): Promise<BranchCashBoardData[]> {
  const [branches, sessions] = await Promise.all([
    prisma.branch.findMany({
      where: { NOT: { name: { contains: "office", mode: "insensitive" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.cashSession.findMany({ where: { date: dateKey } }),
  ]);
  const byBranch = new Map(sessions.map((s) => [s.branchId, s]));
  return Promise.all(
    branches.map(async (branch) => {
      const s = byBranch.get(branch.id) ?? null;
      const open: Buckets = s
        ? { cash: s.openCash, mandiri: s.openMandiri, bca: s.openBca, bri: s.openBri }
        : zeroBuckets();
      const report = await computeBranchCash(branch.id, dateKey, open);
      const close =
        s?.closedAt != null
          ? { cash: s.closeCash ?? 0, mandiri: s.closeMandiri ?? 0, bca: s.closeBca ?? 0, bri: s.closeBri ?? 0 }
          : null;
      return { branch, opened: !!s, open, report, close };
    }),
  );
}

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type SalesTrend = { months: string[]; series: { id: string; name: string; points: number[] }[] };

/** Total penjualan per cabang per bulan, 6 bulan terakhir (WIB). 1 garis per cabang. */
export async function loadBranchSalesTrend(now = new Date()): Promise<SalesTrend> {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  // 6 kunci bulan (WIB) dari 5 bulan lalu sampai bulan ini.
  const keys: { y: number; m: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - i, 1));
    keys.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }
  const from = new Date(Date.UTC(keys[0].y, keys[0].m, 1) - 7 * 3600_000); // WIB awal bulan pertama
  const idx = new Map(keys.map((k, i) => [`${k.y}-${k.m}`, i]));

  const [branches, sales] = await Promise.all([
    prisma.branch.findMany({
      where: { NOT: { name: { contains: "office", mode: "insensitive" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.salesReport.findMany({
      where: { branchId: { not: null }, soldAt: { gte: from } },
      select: { branchId: true, soldAt: true, grandTotal: true },
    }),
  ]);

  const byBranch = new Map(branches.map((b) => [b.id, new Array(6).fill(0) as number[]]));
  for (const s of sales) {
    const arr = byBranch.get(s.branchId!);
    if (!arr) continue; // cabang Office / terhapus
    const w = new Date(s.soldAt.getTime() + 7 * 3600_000);
    const i = idx.get(`${w.getUTCFullYear()}-${w.getUTCMonth()}`);
    if (i != null) arr[i] += s.grandTotal;
  }
  return {
    months: keys.map((k) => MONTH_ID[k.m]),
    series: branches.map((b) => ({ id: b.id, name: b.name, points: byBranch.get(b.id)! })),
  };
}

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
