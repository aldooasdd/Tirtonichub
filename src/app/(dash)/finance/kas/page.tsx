import { requireFinance } from "@/server/auth/rbac";
import { loadBranchCashBoards, loadBranchSalesTrends, loadCashMovements, loadCashSessions } from "@/lib/cash";
import { CashDashboard } from "@/components/cash/cash-dashboard";

function todayKeyStr(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export default async function FinanceKasPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireFinance();
  const sp = await searchParams;
  const dateStr = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKeyStr();
  const dateKey = new Date(dateStr + "T00:00:00Z");

  const [boards, trends, moves, sessions] = await Promise.all([
    loadBranchCashBoards(dateKey),
    loadBranchSalesTrends(),
    loadCashMovements(dateKey),
    loadCashSessions(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Saldo Kasir Semua Cabang</h1>
          <p className="text-14 text-muted-foreground">Saldo laci + EDC per cabang. Selisih merah = tak cocok.</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Tanggal
            <input type="date" name="date" defaultValue={dateStr} className="h-9 rounded-md border bg-card px-2 text-14" />
          </label>
          <button type="submit" className="h-9 rounded-md border bg-card px-3 text-14 font-medium">Terapkan</button>
        </form>
      </div>
      <CashDashboard boards={boards} trends={trends} moves={moves} sessions={sessions} movesDay={dateStr} />
    </div>
  );
}
