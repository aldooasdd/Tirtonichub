import { requireFinance } from "@/server/auth/rbac";
import { dateKeyWIB } from "@/server/attendance/logic";
import { loadBranchCashBoards, loadBranchSalesTrends, loadCashMovements, loadCashSessions } from "@/lib/cash";
import { CashDashboard } from "@/components/cash/cash-dashboard";

export default async function FinanceKasPage() {
  await requireFinance();
  const today = dateKeyWIB(new Date());
  const [boards, trends, moves, sessions] = await Promise.all([
    loadBranchCashBoards(today),
    loadBranchSalesTrends(),
    loadCashMovements(today),
    loadCashSessions(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Saldo Kasir Semua Cabang</h1>
        <p className="text-14 text-muted-foreground">Saldo laci + EDC hari ini per cabang. Selisih merah = tak cocok.</p>
      </div>
      <CashDashboard boards={boards} trends={trends} moves={moves} sessions={sessions} />
    </div>
  );
}
