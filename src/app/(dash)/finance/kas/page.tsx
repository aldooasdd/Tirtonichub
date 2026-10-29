import { requireFinance } from "@/server/auth/rbac";
import { dateKeyWIB } from "@/server/attendance/logic";
import { loadBranchCashBoards } from "@/lib/cash";
import { BranchCashBoard } from "@/components/cash/branch-cash-board";
import { BranchCashTreemap } from "@/components/cash/branch-cash-treemap";

export default async function FinanceKasPage() {
  await requireFinance();
  const boards = await loadBranchCashBoards(dateKeyWIB(new Date()));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Saldo Kasir Semua Cabang</h1>
        <p className="text-14 text-muted-foreground">Saldo laci + EDC hari ini per cabang. Selisih merah = tak cocok.</p>
      </div>
      <BranchCashTreemap
        branches={boards.map(({ branch, opened, report, close }) => ({
          id: branch.id,
          name: branch.name,
          opened,
          expected: report.expected,
          close,
        }))}
      />

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
