import { redirect } from "next/navigation";
import { ABSEN_ON } from "@/lib/flags";
import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { dailyRekap, monthlyRekap } from "@/server/attendance/rekap";
import { fileUrl } from "@/server/storage";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  ON_TIME: "Tepat waktu",
  LATE: "Terlambat",
  ABSENT: "Belum/Tidak absen",
  LEAVE: "Cuti",
  SICK: "Sakit",
  PERMIT: "Izin",
  HOLIDAY: "Libur",
  OFF: "Libur (jadwal)",
};

function todayKeyStr(): string {
  const w = new Date(Date.now() + 7 * 3600 * 1000);
  return w.toISOString().slice(0, 10);
}

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string; view?: string; m?: string }>;
}) {
  if (!ABSEN_ON) redirect("/beranda");
  await requireHr();
  const sp = await searchParams;
  const view = sp.view === "bulanan" ? "bulanan" : "harian";
  const branchId = sp.branch || undefined;
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });

  const dateStr = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKeyStr();
  const monthStr = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : dateStr.slice(0, 7);

  const qs = new URLSearchParams();
  if (branchId) qs.set("branch", branchId);
  qs.set("view", view);
  if (view === "harian") qs.set("date", dateStr);
  else qs.set("m", monthStr);
  const exportHref = `/hr/rekap/export?${qs.toString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-24 font-semibold">Rekap Absen</h1>
        <Button asChild variant="secondary">
          <a href={exportHref}>Export Excel</a>
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="flex flex-col gap-1 text-14">
          Tampilan
          <select name="view" defaultValue={view} className="h-9 rounded-md border bg-background px-2">
            <option value="harian">Harian</option>
            <option value="bulanan">Bulanan</option>
          </select>
        </label>
        {view === "harian" ? (
          <label className="flex flex-col gap-1 text-14">
            Tanggal
            <input type="date" name="date" defaultValue={dateStr} className="h-9 rounded-md border bg-background px-2" />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-14">
            Bulan
            <input type="month" name="m" defaultValue={monthStr} className="h-9 rounded-md border bg-background px-2" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-14">
          Cabang
          <select name="branch" defaultValue={branchId ?? ""} className="h-9 rounded-md border bg-background px-2">
            <option value="">Semua cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Terapkan</Button>
      </form>

      {view === "harian" ? (
        <DailyView date={dateStr} branchId={branchId} />
      ) : (
        <MonthlyView monthStr={monthStr} branchId={branchId} />
      )}
    </div>
  );
}

async function DailyView({ date, branchId }: { date: string; branchId?: string }) {
  const dateKey = new Date(date + "T00:00:00Z");
  const { rows, summary } = await dailyRekap(dateKey, branchId);
  const fotoUrls = await Promise.all(
    rows.map((r) => (r.checkInPhotoKey ? fileUrl(r.checkInPhotoKey) : Promise.resolve(null))),
  );

  return (
    <>
      <div className="flex flex-wrap gap-2 text-14">
        <Chip label="Tepat waktu" value={summary.onTime} />
        <Chip label="Terlambat" value={summary.late} />
        <Chip label="Belum/Tidak absen" value={summary.absent} />
        <Chip label="Izin" value={summary.permit} />
        <Chip label="Sakit" value={summary.sick} />
        <Chip label="Cuti" value={summary.leave} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead className="text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
              <th>Nama</th>
              <th>Cabang</th>
              <th>Masuk</th>
              <th>Pulang</th>
              <th>Status</th>
              <th>Foto</th>
              <th>Lokasi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId} className="border-t [&>td]:px-3 [&>td]:py-2">
                <td className="font-medium">{r.name}</td>
                <td className="text-muted-foreground">{r.branch ?? "—"}</td>
                <td>{r.checkInAt ? fmtWIB(r.checkInAt) : "—"}</td>
                <td>{r.checkOutAt ? fmtWIB(r.checkOutAt) : "—"}</td>
                <td>
                  {STATUS_LABEL[r.status]}
                  {r.status === "LATE" ? ` ${r.lateMinutes}m` : ""}
                </td>
                <td>
                  {fotoUrls[i] ? (
                    <a href={fotoUrls[i]!} target="_blank" className="text-brand underline">
                      Lihat
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.checkInLat != null && r.checkInLng != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}`}
                      target="_blank"
                      className="text-brand underline"
                    >
                      Peta
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function MonthlyView({ monthStr, branchId }: { monthStr: string; branchId?: string }) {
  const [y, m] = monthStr.split("-").map(Number);
  const rows = await monthlyRekap(y, m - 1, branchId);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-14">
        <thead className="text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
            <th>Nama</th>
            <th className="text-right">Hadir</th>
            <th className="text-right">Telat</th>
            <th className="text-right">Menit telat</th>
            <th className="text-right">Izin</th>
            <th className="text-right">Sakit</th>
            <th className="text-right">Cuti</th>
            <th className="text-right">Total jam</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t [&>td]:px-3 [&>td]:py-2 [&>td:not(:first-child)]:text-right">
              <td className="font-medium">{r.name}</td>
              <td>{r.hadir}</td>
              <td>{r.telat}</td>
              <td>{r.telatMenit}</td>
              <td>{r.izin}</td>
              <td>{r.sakit}</td>
              <td>{r.cuti}</td>
              <td>{r.totalJam}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-muted px-3 py-1.5">
      {label}: <b>{value}</b>
    </span>
  );
}
