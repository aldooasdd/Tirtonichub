import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ABSEN_ON } from "@/lib/flags";
import { roleAttends } from "@/lib/roles";
import { dateKeyWIB, wibMinutesOfDay, parseHHMM } from "@/server/attendance/logic";
import { shiftScheduleFor } from "@/server/attendance/shift-schedule";
import { fmtWIB } from "@/lib/datetime";
import { AbsenCapture } from "@/components/absen/absen-capture";

export default async function AbsenPage() {
  if (!ABSEN_ON) redirect("/beranda");
  const ctx = await requireAuth();

  if (!roleAttends(ctx.activeRole)) {
    return (
      <div className="rounded-lg bg-card p-6 text-center text-muted-foreground">
        Role Boss tidak melakukan absen.
      </div>
    );
  }

  const today = dateKeyWIB(new Date());
  const att = await prisma.attendance.findUnique({
    where: { userId_date: { userId: ctx.userId, date: today } },
  });

  const phase: "in" | "out" | "done" = !att?.checkInAt
    ? "in"
    : !att.checkOutAt
      ? "out"
      : "done";

  // Tombol pulang baru aktif setelah shift berakhir.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { fullName: true } });
  const shiftSched = phase === "out" ? await shiftScheduleFor({ id: ctx.userId, fullName: user.fullName }, today) : null;
  const tooEarly = phase === "out" && !!shiftSched && wibMinutesOfDay(new Date()) < parseHHMM(shiftSched.end);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-24 font-semibold">Absen</h1>

      <div className="rounded-lg bg-card p-4 text-14">
        <p className="text-muted-foreground">Status hari ini</p>
        <p className="font-medium">
          {att?.checkInAt ? `Masuk ${fmtWIB(att.checkInAt)}` : "Belum absen masuk"}
          {att?.checkInAt && att.status === "LATE" ? ` · Terlambat ${att.lateMinutes}m` : ""}
        </p>
        {att?.checkOutAt && <p className="font-medium">Pulang {fmtWIB(att.checkOutAt)}</p>}
      </div>

      {phase === "done" ? (
        <div className="rounded-lg bg-card p-6 text-center text-muted-foreground">
          Absen hari ini sudah lengkap. Sampai jumpa besok.
        </div>
      ) : tooEarly ? (
        <div className="rounded-lg bg-card p-6 text-center text-muted-foreground">
          Absen pulang tersedia setelah shift berakhir ({shiftSched!.end}).
        </div>
      ) : (
        <AbsenCapture mode={phase} />
      )}
    </div>
  );
}
