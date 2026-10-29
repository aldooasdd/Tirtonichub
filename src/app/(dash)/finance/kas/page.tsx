import { requireFinance } from "@/server/auth/rbac";
import { dateKeyWIB } from "@/server/attendance/logic";
import { loadBranchCashBoards, loadBranchSalesTrend } from "@/lib/cash";
import { BranchCashBoard } from "@/components/cash/branch-cash-board";
import { BranchCashTreemap } from "@/components/cash/branch-cash-treemap";
import { BranchSalesChart } from "@/components/cash/branch-sales-chart";

export default async function FinanceKasPage() {
  await requireFinance();
  const [boards, trend] = await Promise.all([
    loadBranchCashBoards(dateKeyWIB(new Date())),
    loadBranchSalesTrend(),
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
        />
        <BranchSalesChart trend={trend} />
      </div>

      <div className="space-y-5">
        {boards.map(({ branch, opened, open, report, close }) => (
          <div key={branch.id} className="space-y-2">
            <h2 className="text-14 font-semibold text-muted-foreground">{branch.name}</h2>
            <BranchCashBoard
              opened={opened}
              open={open}
              masuk={report.masuk}
              cashout={report.cashout}
              expected={report.expected}
              close={close}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
