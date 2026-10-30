import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ROLE_LABELS, roleAttends } from "@/lib/roles";
import { defaultShift } from "@/lib/shift-default";
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

  const all = await prisma.user.findMany({
    where: { isActive: true, branchId },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, roles: { select: { role: { select: { code: true } } } } },
  });
  // Hanya yang kerja shift (punya role selain Direksi/BOSS) yang masuk jadwal.
  const employees = all.filter((e) => e.roles.some((r) => roleAttends(r.role.code)));
  const ids = employees.map((e) => e.id);

  const shifts = ids.length
    ? await prisma.shift.findMany({
        where: { userId: { in: ids }, date: { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m - 1, dim)) } },
        select: { userId: true, date: true, code: true },
      })
    : [];

  // saved: "userId:day" → code (hasil edit HR, menimpa default)
  const cells: Record<string, string> = {};
  for (const s of shifts) cells[`${s.userId}:${s.date.getUTCDate()}`] = s.code;

  // default: pola PDF per karyawan per tanggal (sama tiap bulan)
  const defaults: Record<string, string> = {};
  for (const e of employees) {
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const c = defaultShift(e.fullName, d, dow);
      if (c) defaults[`${e.id}:${d}`] = c;
    }
  }

  return (
    <JadwalGrid
      key={`${ym}:${branchId}`}
      ym={ym}
      days={dim}
      branchId={branchId}
      branches={branches}
      employees={employees.map((e) => ({ id: e.id, name: e.fullName, role: ROLE_LABELS[e.roles[0]?.role.code ?? "SALES"] ?? "" }))}
      initialCells={cells}
      defaults={defaults}
    />
  );
}
