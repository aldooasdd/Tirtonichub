import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ROLE_LABELS } from "@/lib/roles";
import { JadwalGrid } from "@/components/hr/jadwal-grid";

function curYm() {
  const d = new Date(Date.now() + 7 * 3600_000); // WIB
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; branch?: string }>;
}) {
  await requireHr();
  const sp = await searchParams;
  const ym = /^\d{4}-\d{2}$/.test(sp.ym ?? "") ? sp.ym! : curYm();
  const [y, m] = ym.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const branchId = sp.branch || branches[0]?.id || "";

  const employees = await prisma.user.findMany({
    where: { isActive: true, branchId },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, roles: { select: { role: { select: { code: true } } } } },
  });
  const ids = employees.map((e) => e.id);

  const shifts = ids.length
    ? await prisma.shift.findMany({
        where: { userId: { in: ids }, date: { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m - 1, dim)) } },
        select: { userId: true, date: true, code: true },
      })
    : [];

  // map "userId:day" → code
  const cells: Record<string, string> = {};
  for (const s of shifts) cells[`${s.userId}:${s.date.getUTCDate()}`] = s.code;

  return (
    <JadwalGrid
      ym={ym}
      days={dim}
      branchId={branchId}
      branches={branches}
      employees={employees.map((e) => ({ id: e.id, name: e.fullName, role: ROLE_LABELS[e.roles[0]?.role.code ?? "SALES"] ?? "" }))}
      initialCells={cells}
    />
  );
}
