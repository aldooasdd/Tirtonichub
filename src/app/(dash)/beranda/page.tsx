import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { roleAttends } from "@/lib/roles";
import { fmtWIB } from "@/lib/datetime";
import { dateKeyWIB } from "@/server/attendance/logic";

function Kpi({ label, value, bg }: { label: string; value: string | number; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-6 text-kpi-foreground`}>
      <p className="text-14">{label}</p>
      <p className="mt-3 text-24 font-semibold leading-none">{value}</p>
    </div>
  );
}

export default async function BerandaPage() {
  const ctx = await requireAuth();
  const today = dateKeyWIB(new Date());

  if (!roleAttends(ctx.activeRole)) {
    // Boss: ringkasan perusahaan (PRD §6.4)
    const [karyawanAktif, pending, hadirHariIni] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.request.count({ where: { status: "PENDING" } }),
      prisma.attendance.count({
        where: { date: today, status: { in: ["ON_TIME", "LATE"] } },
      }),
    ]);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-16 font-semibold">Beranda</h1>
          <p className="text-14 text-muted-foreground">Ringkasan perusahaan.</p>
        </div>
        <section className="grid grid-cols-2 gap-5 lg:grid-cols-3">
          <Kpi label="Karyawan aktif" value={karyawanAktif} bg="bg-kpi-1" />
          <Kpi label="Hadir hari ini" value={hadirHariIni} bg="bg-kpi-2" />
          <Kpi label="Pengajuan pending" value={pending} bg="bg-kpi-1" />
        </section>
      </div>
    );
  }

  // Karyawan: KPI absensi personal
  const now = new Date();
  const year = today.getUTCFullYear();
  const monthStart = new Date(Date.UTC(year, today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(year, today.getUTCMonth() + 1, 1));
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [user, monthRows, pending, att, leaveReqs] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { joinedAt: true } }),
    prisma.attendance.findMany({
      where: { userId: ctx.userId, date: { gte: monthStart, lt: monthEnd } },
      select: { status: true },
    }),
    prisma.request.count({ where: { userId: ctx.userId, status: "PENDING" } }),
    prisma.attendance.findUnique({ where: { userId_date: { userId: ctx.userId, date: today } } }),
    prisma.request.findMany({
      where: {
        userId: ctx.userId,
        type: "LEAVE",
        status: "APPROVED",
        startDate: { gte: yearStart, lt: yearEnd },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const hadir = monthRows.filter((r) => r.status === "ON_TIME" || r.status === "LATE").length;
  const telat = monthRows.filter((r) => r.status === "LATE").length;

  const tenureOk =
    user.joinedAt != null && now.getTime() - user.joinedAt.getTime() >= 365 * 86_400_000;
  const cutiTerpakai = leaveReqs.reduce(
    (sum, r) =>
      sum + Math.floor((r.endDate.getTime() - r.startDate.getTime()) / 86_400_000) + 1,
    0,
  );
  const sisaCuti = tenureOk ? Math.max(0, 12 - cutiTerpakai) : 0;

  const absenPhase = !att?.checkInAt ? "in" : !att.checkOutAt ? "out" : "done";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-24 font-semibold">Beranda</h1>
        <p className="text-14 text-muted-foreground">Ringkasan kinerja & absensi kamu.</p>
      </div>

      <section className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi label="Hadir bulan ini" value={hadir} bg="bg-kpi-1" />
        <Kpi label="Terlambat" value={telat} bg="bg-kpi-2" />
        <Kpi label="Sisa cuti" value={sisaCuti} bg="bg-kpi-1" />
        <Kpi label="Pengajuan pending" value={pending} bg="bg-kpi-2" />
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-12 text-muted-foreground">Status hari ini</p>
              <p className="text-14 font-semibold">
                {!att?.checkInAt
                  ? "Belum absen masuk"
                  : `Masuk ${fmtWIB(att.checkInAt)}${att.status === "LATE" ? ` (telat ${att.lateMinutes}m)` : ""}`}
                {att?.checkOutAt ? ` · Pulang ${fmtWIB(att.checkOutAt)}` : ""}
              </p>
            </div>
          </div>
          {absenPhase !== "done" && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/absen">{absenPhase === "in" ? "Absen Masuk" : "Absen Pulang"}</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-3 text-14 font-semibold">Tugas harian</h2>
        <p className="rounded-xl bg-muted p-6 text-center text-14 text-muted-foreground">
          Belum ada tugas.
        </p>
      </section>
    </div>
  );
}
