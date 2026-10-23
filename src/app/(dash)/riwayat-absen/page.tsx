import Link from "next/link";
import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { roleAttends } from "@/lib/roles";
import { fmtWIB } from "@/lib/datetime";
import { dateKeyWIB } from "@/server/attendance/logic";

const STATUS_LABEL: Record<string, string> = {
  ON_TIME: "Tepat waktu",
  LATE: "Terlambat",
  ABSENT: "Tidak hadir",
  LEAVE: "Cuti",
  SICK: "Sakit",
  PERMIT: "Izin",
  HOLIDAY: "Libur",
};

function monthParam(m: string | undefined): { year: number; month: number } {
  const now = dateKeyWIB(new Date());
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month: mo - 1 };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const ctx = await requireAuth();
  if (!roleAttends(ctx.activeRole)) {
    return (
      <div className="rounded-lg bg-card p-6 text-center text-muted-foreground">
        Role Boss tidak melakukan absen.
      </div>
    );
  }

  const { m } = await searchParams;
  const { year, month } = monthParam(m);
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  const rows = await prisma.attendance.findMany({
    where: { userId: ctx.userId, date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
  });

  const hadir = rows.filter((r) => r.status === "ON_TIME" || r.status === "LATE").length;
  const telat = rows.filter((r) => r.status === "LATE").length;

  const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month, 1)),
  );
  const prev = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month + 1, 1));
  const toParam = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Riwayat Absen</h1>

      <div className="flex items-center justify-between">
        <Link href={`?m=${toParam(prev)}`} className="text-14 text-muted-foreground hover:text-foreground">
          ← Bulan lalu
        </Link>
        <span className="font-medium">{label}</span>
        <Link href={`?m=${toParam(next)}`} className="text-14 text-muted-foreground hover:text-foreground">
          Bulan depan →
        </Link>
      </div>

      <div className="rounded-lg bg-card p-4 text-14">
        Hadir: <b>{hadir}</b> · Terlambat: <b>{telat}</b>
      </div>

      <div className="flex flex-col gap-2">
        {rows.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Belum ada absen bulan ini.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="font-medium">
                {new Intl.DateTimeFormat("id-ID", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  timeZone: "UTC",
                }).format(r.date)}
              </p>
              <p className="text-14 text-muted-foreground">
                {r.checkInAt ? fmtWIB(r.checkInAt) : "—"}
                {r.checkOutAt ? ` → ${fmtWIB(r.checkOutAt)}` : ""}
              </p>
            </div>
            <span className="text-14">
              {STATUS_LABEL[r.status]}
              {r.status === "LATE" ? ` ${r.lateMinutes}m` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
