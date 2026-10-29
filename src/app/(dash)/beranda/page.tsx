import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { roleAttends } from "@/lib/roles";
import { ABSEN_ON } from "@/lib/flags";
import { fmtWIB } from "@/lib/datetime";
import { dateKeyWIB, wibMinutesOfDay, parseHHMM } from "@/server/attendance/logic";
import { shiftScheduleFor } from "@/server/attendance/shift-schedule";
import { loadCalendarEvents } from "@/server/calendar-events";
import { KalenderClient } from "@/components/kalender/kalender-client";
import { computeBranchCash, zeroBuckets, type Buckets } from "@/lib/cash";
import { CashOpenForm, CashCloseForm } from "@/components/cash/cash-forms";
import { BranchCashBoard } from "@/components/cash/branch-cash-board";

function Kpi({ label, value, bg, small }: { label: string; value: string | number; bg: string; small?: boolean }) {
  return (
    <div className={`${bg} rounded-2xl text-kpi-foreground ${small ? "p-3" : "p-6"}`}>
      <p className={small ? "text-11" : "text-14"}>{label}</p>
      <p className={`mt-1 font-semibold leading-none ${small ? "text-16" : "mt-3 text-24"}`}>{value}</p>
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
        <KalenderClient events={await loadCalendarEvents()} />
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
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { joinedAt: true, fullName: true, branchId: true } }),
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

  // Saldo kasir cabang (untuk Sales input & Kepala Cabang pantau).
  const isSales = ctx.activeRole === "SALES";
  const isHeadBranch = ctx.activeRole === "HEAD_BRANCH";
  let cashSession: Awaited<ReturnType<typeof prisma.cashSession.findUnique>> = null;
  let cashOpen: Buckets = zeroBuckets();
  let cashReport: Awaited<ReturnType<typeof computeBranchCash>> | null = null;
  if (user.branchId && (isSales || isHeadBranch)) {
    cashSession = await prisma.cashSession.findUnique({
      where: { branchId_date: { branchId: user.branchId, date: today } },
    });
    cashOpen = cashSession
      ? { cash: cashSession.openCash, mandiri: cashSession.openMandiri, bca: cashSession.openBca, bri: cashSession.openBri }
      : zeroBuckets();
    cashReport = await computeBranchCash(user.branchId, today, cashOpen);
  }
  const cashClose =
    cashSession?.closedAt != null
      ? { cash: cashSession.closeCash ?? 0, mandiri: cashSession.closeMandiri ?? 0, bca: cashSession.closeBca ?? 0, bri: cashSession.closeBri ?? 0 }
      : null;
  // Buka saldo: perwakilan (sales pertama yang absen masuk) saat belum ada sesi.
  const needOpenCash = isSales && !!att?.checkInAt && !cashSession;
  // Tutup saldo: hanya yang buka (perwakilan).
  const needCloseCash =
    isSales && !!cashSession && cashSession.openedById === ctx.userId && !cashSession.closedAt && !att?.checkOutAt;

  const absenPhase = !att?.checkInAt ? "in" : !att.checkOutAt ? "out" : "done";
  // Media: jadwal fleksibel → pulang setelah 5 jam. Lainnya: setelah shift berakhir.
  const isMedia = ctx.activeRole === "MEDIA";
  const shiftSched =
    ABSEN_ON && absenPhase === "out" && !isMedia
      ? await shiftScheduleFor({ id: ctx.userId, fullName: user.fullName }, today)
      : null;
  const canCheckOut = isMedia
    ? !!att?.checkInAt && now.getTime() - att.checkInAt.getTime() >= 5 * 3600_000
    : !shiftSched || wibMinutesOfDay(now) >= parseHHMM(shiftSched.end);
  const checkoutHint = isMedia
    ? "Absen pulang tersedia setelah 5 jam kerja."
    : `Absen pulang tersedia setelah shift berakhir${shiftSched ? ` (${shiftSched.end})` : ""}.`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-24 font-semibold">Beranda</h1>
        <p className="text-14 text-muted-foreground">Ringkasan kinerja & absensi kamu.</p>
      </div>

      {isHeadBranch && cashReport && (
        <BranchCashBoard
          opened={!!cashSession}
          open={cashOpen}
          masuk={cashReport.masuk}
          cashout={cashReport.cashout}
          expected={cashReport.expected}
          close={cashClose}
        />
      )}

      <section className={isHeadBranch ? "grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" : "grid grid-cols-2 gap-5 lg:grid-cols-4"}>
        <Kpi label="Hadir bulan ini" value={hadir} bg="bg-kpi-1" small={isHeadBranch} />
        <Kpi label="Terlambat" value={telat} bg="bg-kpi-2" small={isHeadBranch} />
        <Kpi label="Sisa cuti" value={sisaCuti} bg="bg-kpi-1" small={isHeadBranch} />
        <Kpi label="Pengajuan pending" value={pending} bg="bg-kpi-2" small={isHeadBranch} />
      </section>

      {needOpenCash && <CashOpenForm />}

      {ABSEN_ON && (
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
            {absenPhase === "in" && (
              <Button asChild className="w-full sm:w-auto">
                <Link href="/absen">Absen Masuk</Link>
              </Button>
            )}
            {absenPhase === "out" &&
              (canCheckOut ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/absen">Absen Pulang</Link>
                </Button>
              ) : (
                <p className="text-12 text-muted-foreground">{checkoutHint}</p>
              ))}
          </div>
        </section>
      )}

      {needCloseCash && <CashCloseForm />}

      <KalenderClient events={await loadCalendarEvents({ userId: ctx.userId, fullName: user.fullName, branchId: user.branchId })} />
    </div>
  );
}
