import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { dateKeyWIB } from "@/server/attendance/logic";
import { computeBranchCash, zeroBuckets, type Buckets } from "@/lib/cash";
import { BranchCashBoard } from "@/components/cash/branch-cash-board";
import { BranchCashTreemap } from "@/components/cash/branch-cash-treemap";

export default async function FinanceKasPage() {
  await requireFinance();
  const today = dateKeyWIB(new Date());

  const [branches, sessions] = await Promise.all([
    // Office tak punya kasir → sembunyikan.
    prisma.branch.findMany({
      where: { NOT: { name: { contains: "office", mode: "insensitive" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.cashSession.findMany({ where: { date: today } }),
  ]);
  const byBranch = new Map(sessions.map((s) => [s.branchId, s]));

  const boards = await Promise.all(
    branches.map(async (b) => {
      const s = byBranch.get(b.id) ?? null;
      const open: Buckets = s
        ? { cash: s.openCash, mandiri: s.openMandiri, bca: s.openBca, bri: s.openBri }
        : zeroBuckets();
      const report = await computeBranchCash(b.id, today, open);
      const close =
        s?.closedAt != null
          ? { cash: s.closeCash ?? 0, mandiri: s.closeMandiri ?? 0, bca: s.closeBca ?? 0, bri: s.closeBri ?? 0 }
          : null;
      return { branch: b, opened: !!s, open, report, close };
    }),
  );

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
