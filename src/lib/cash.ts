import { prisma } from "@/server/db";

export type Buckets = { cash: number; mandiri: number; bca: number; bri: number };
export const zeroBuckets = (): Buckets => ({ cash: 0, mandiri: 0, bca: 0, bri: 0 });

export const BUCKET_LABEL: Record<keyof Buckets, string> = {
  cash: "Cash (laci)",
  mandiri: "EDC Mandiri",
  bca: "EDC BCA",
  bri: "EDC BRI",
};

/** Metode bayar POS → penempatan saldo kasir.
 *  Daftar POS: Tunai; CC/Debit/Debit Selain/QRIS/Transfer + {BCA,BRI,Mandiri} → EDC bank itu.
 *  SHOPEE/TOKOPEDIA/WEBSITE = online (duit ke marketplace, bukan laci/EDC) → null, tak masuk kasir. */
export function bucketOf(method: string): keyof Buckets | null {
  const m = (method || "").toLowerCase();
  if (/shopee|tokopedia|website|tiktok|lazada|blibli|online|marketplace/.test(m)) return null;
  if (m.includes("mandiri")) return "mandiri";
  if (m.includes("bca")) return "bca";
  if (m.includes("bri")) return "bri";
  return "cash"; // Tunai & lainnya
}

export type KasirShift = "PAGI" | "SIANG";
export const SHIFT_LABEL: Record<KasirShift, string> = { PAGI: "Pagi", SIANG: "Siang" };

/** Kode jadwal → shift kasir. P/LONG = Pagi, S = Siang, lainnya (OH/O/WFH/…) tak buka kasir. */
export function kasirShift(code: string): KasirShift | null {
  if (code === "P" || code === "LONG") return "PAGI";
  if (code === "S") return "SIANG";
  return null;
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
    prisma.cashSession.findMany({ where: { date: dateKey }, orderBy: { openedAt: "asc" } }),
  ]);
  // Bisa 2 sesi/cabang (Pagi+Siang, laci sama). Saldo awal = buka paling pagi; akhir = tutup sesi terakhir.
  const byBranch = new Map<string, typeof sessions>();
  for (const s of sessions) (byBranch.get(s.branchId) ?? byBranch.set(s.branchId, []).get(s.branchId)!).push(s);
  return Promise.all(
    branches.map(async (branch) => {
      const list = byBranch.get(branch.id) ?? [];
      const first = list[0] ?? null; // paling pagi
      const last = list[list.length - 1] ?? null; // shift terakhir
      const open: Buckets = first
        ? { cash: first.openCash, mandiri: first.openMandiri, bca: first.openBca, bri: first.openBri }
        : zeroBuckets();
      const report = await computeBranchCash(branch.id, dateKey, open);
      const close =
        last?.closedAt != null
          ? { cash: last.closeCash ?? 0, mandiri: last.closeMandiri ?? 0, bca: last.closeBca ?? 0, bri: last.closeBri ?? 0 }
          : null;
      return { branch, opened: list.length > 0, open, report, close };
    }),
  );
}

export type CashMovement = {
  id: string;
  at: Date;
  branch: string;
  kind: "in" | "out"; // penjualan masuk / pembelian keluar
  bucket: keyof Buckets;
  amount: number; // selalu positif; tanda dari kind
  note: string;
};

/** Riwayat uang masuk (penjualan) & keluar (pembelian), semua cabang, terbaru dulu.
 *  days = jumlah hari ke belakang (termasuk dateKey) biar bisa filter hari sebelumnya di UI. */
export async function loadCashMovements(dateKey: Date, take = 400, days = 30): Promise<CashMovement[]> {
  const end = dayRange(dateKey).end;
  const start = new Date(dayRange(dateKey).start.getTime() - (days - 1) * 86_400_000);
  const [sales, cashouts] = await Promise.all([
    prisma.salesReport.findMany({
      where: { channel: "offline", branchId: { not: null }, createdAt: { gte: start, lt: end } },
      select: { id: true, createdAt: true, branchName: true, payments: true, notaNo: true },
    }),
    prisma.cashout.findMany({
      where: { branchId: { not: null }, createdAt: { gte: start, lt: end } },
      select: { id: true, createdAt: true, branchName: true, amount: true, description: true },
    }),
  ]);

  const out: CashMovement[] = [];
  for (const s of sales) {
    const pays = (Array.isArray(s.payments) ? s.payments : []) as { method?: string; amount?: number }[];
    for (const [i, p] of pays.entries()) {
      const amt = Math.max(0, Math.round(p.amount ?? 0));
      const bk = bucketOf(p.method ?? "");
      if (amt <= 0 || !bk) continue; // online (SHOPEE/dll) tak masuk kasir
      out.push({ id: `${s.id}-${i}`, at: s.createdAt, branch: s.branchName ?? "-", kind: "in", bucket: bk, amount: amt, note: s.notaNo ? `Nota ${s.notaNo}` : "Penjualan" });
    }
  }
  for (const c of cashouts)
    out.push({ id: c.id, at: c.createdAt, branch: c.branchName ?? "-", kind: "out", bucket: "cash", amount: c.amount, note: c.description || "Pembelian" });

  return out.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

export type CashSessionRow = {
  id: string;
  branchId: string;
  branch: string;
  date: Date;
  openAt: Date;
  openBy: string;
  open: Buckets;
  closeAt: Date | null;
  closeBy: string | null;
  close: Buckets | null;
};

/** Riwayat buka/tutup kasir semua cabang (terbaru dulu). Dashboard kelompokkan per cabang. */
export async function loadCashSessions(take = 120): Promise<CashSessionRow[]> {
  const sessions = await prisma.cashSession.findMany({
    orderBy: { openedAt: "desc" },
    take,
    include: { branch: { select: { name: true } } },
  });
  const ids = [...new Set(sessions.flatMap((s) => [s.openedById, s.closedById]).filter(Boolean) as string[])];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } }) : [];
  const name = new Map(users.map((u) => [u.id, u.fullName]));
  return sessions.map((s) => ({
    id: s.id,
    branchId: s.branchId,
    branch: s.branch.name,
    date: s.date,
    openAt: s.openedAt,
    openBy: name.get(s.openedById) ?? "-",
    open: { cash: s.openCash, mandiri: s.openMandiri, bca: s.openBca, bri: s.openBri },
    closeAt: s.closedAt,
    closeBy: s.closedById ? name.get(s.closedById) ?? "-" : null,
    close: s.closedAt != null ? { cash: s.closeCash ?? 0, mandiri: s.closeMandiri ?? 0, bca: s.closeBca ?? 0, bri: s.closeBri ?? 0 } : null,
  }));
}

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type SalesTrend = { labels: string[]; series: { id: string; name: string; points: number[] }[] };
export type SalesTrends = { harian: SalesTrend; bulanan: SalesTrend; tahunan: SalesTrend };

type BranchLite = { id: string; name: string };
type SaleLite = { branchId: string | null; wib: Date; grandTotal: number };

/** Bikin 1 trend: bucket penjualan per kunci waktu. keyOf(wib) harus cocok salah satu key. */
function trendFrom(branches: BranchLite[], sales: SaleLite[], keys: { k: string; label: string }[], keyOf: (wib: Date) => string): SalesTrend {
  const idx = new Map(keys.map((kk, i) => [kk.k, i]));
  const byBranch = new Map(branches.map((b) => [b.id, new Array(keys.length).fill(0) as number[]]));
  for (const s of sales) {
    const arr = s.branchId ? byBranch.get(s.branchId) : null;
    if (!arr) continue; // cabang Office / terhapus
    const i = idx.get(keyOf(s.wib));
    if (i != null) arr[i] += s.grandTotal;
  }
  return { labels: keys.map((k) => k.label), series: branches.map((b) => ({ id: b.id, name: b.name, points: byBranch.get(b.id)! })) };
}

/** Trend penjualan per cabang: harian (30 hr), bulanan (6 bln), tahunan (5 th). WIB. 1 query. */
export async function loadBranchSalesTrends(now = new Date()): Promise<SalesTrends> {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const y0 = wib.getUTCFullYear(), m0 = wib.getUTCMonth(), d0 = wib.getUTCDate();

  const dayKeys: { k: string; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0, d0 - i));
    dayKeys.push({ k: `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`, label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}` });
  }
  const monKeys: { k: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0 - i, 1));
    monKeys.push({ k: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTH_ID[d.getUTCMonth()] });
  }
  const yrKeys: { k: string; label: string }[] = [];
  for (let i = 4; i >= 0; i--) yrKeys.push({ k: String(y0 - i), label: String(y0 - i) });

  const from = new Date(Date.UTC(y0 - 5, 0, 1) - 7 * 3600_000); // 5 th lalu (WIB), paling lebar
  const [branchRows, rows] = await Promise.all([
    prisma.branch.findMany({
      where: { NOT: { name: { contains: "office", mode: "insensitive" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Semua penjualan (offline per cabang + online/website), dihitung real-time saat transaksi.
    prisma.salesReport.findMany({
      where: { soldAt: { gte: from } },
      select: { branchId: true, channel: true, soldAt: true, grandTotal: true },
    }),
  ]);
  // Online/website tak punya cabang → bucket sendiri biar ikut Total Penjualan Semua Cabang.
  const ONLINE_ID = "__online__";
  const branches = [...branchRows, { id: ONLINE_ID, name: "Online / Website" }];
  const sales: SaleLite[] = rows.map((s) => ({
    branchId: s.channel === "online" ? ONLINE_ID : s.branchId,
    wib: new Date(s.soldAt.getTime() + 7 * 3600_000),
    grandTotal: s.grandTotal,
  }));

  return {
    harian: trendFrom(branches, sales, dayKeys, (w) => `${w.getUTCFullYear()}-${w.getUTCMonth()}-${w.getUTCDate()}`),
    bulanan: trendFrom(branches, sales, monKeys, (w) => `${w.getUTCFullYear()}-${w.getUTCMonth()}`),
    tahunan: trendFrom(branches, sales, yrKeys, (w) => String(w.getUTCFullYear())),
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
    for (const p of pays) {
      const bk = bucketOf(p.method ?? "");
      if (bk) masuk[bk] += Math.max(0, Math.round(p.amount ?? 0)); // online tak masuk saldo kasir
    }
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
