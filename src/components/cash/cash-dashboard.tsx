import type { BranchCashBoardData, SalesTrends, CashMovement } from "@/lib/cash";
import { BranchCashTreemap } from "./branch-cash-treemap";
import { BranchSalesChart } from "./branch-sales-chart";
import { CashMovements } from "./cash-movements";

/** Blok dashboard kasir: treemap saldo + riwayat (di dalam) + chart penjualan.
 *  Dipakai Finance (/finance, /finance/kas) dan beranda Boss/Admin. */
export function CashDashboard({ boards, trends, moves }: { boards: BranchCashBoardData[]; trends: SalesTrends; moves: CashMovement[] }) {
  return (
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
  );
}
