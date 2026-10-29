import { requireFinance } from "@/server/auth/rbac";
import { dateKeyWIB } from "@/server/attendance/logic";
import { loadBranchCashBoards, loadBranchSalesTrends, loadCashMovements } from "@/lib/cash";
import { BranchCashTreemap } from "@/components/cash/branch-cash-treemap";
import { BranchSalesChart } from "@/components/cash/branch-sales-chart";
import { CashMovements } from "@/components/cash/cash-movements";

export default async function FinanceKasPage() {
  await requireFinance();
  const today = dateKeyWIB(new Date());
  const [boards, trends, moves] = await Promise.all([
    loadBranchCashBoards(today),
    loadBranchSalesTrends(),
    loadCashMovements(today),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Saldo Kasir Semua Cabang</h1>
        <p className="text-14 text-muted-foreground">Saldo laci + EDC hari ini per cabang. Selisih merah = tak cocok.</p>
      </div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <BranchCashTreemap
          branches={boards.map(({ branch, opened, report, close }) => ({
            id: branch.id,
            name: branch.name,
            opened,
            expected: report.expected,
            close,
          }))}
        >
          <CashMovements rows={moves} />
        </BranchCashTreemap>
        <BranchSalesChart trends={trends} />
      </div>
    </div>
  );
}
