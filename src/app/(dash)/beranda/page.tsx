import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/server/auth/rbac";
import { roleAttends } from "@/lib/roles";

const kpis = [
  { label: "Hadir bulan ini", value: "18", bg: "bg-kpi-1" },
  { label: "Terlambat", value: "2", bg: "bg-kpi-2" },
  { label: "Sisa cuti", value: "10", bg: "bg-kpi-1" },
  { label: "Pengajuan pending", value: "1", bg: "bg-kpi-2" },
];

export default async function BerandaPage() {
  const ctx = await requireAuth();
  const attends = roleAttends(ctx.activeRole); // Boss tak absen (PRD §6.4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-24 font-semibold">Beranda</h1>
        <p className="text-14 text-muted-foreground">Ringkasan kinerja & absensi kamu.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={`${k.bg} rounded-lg p-5 text-kpi-foreground`}>
            <p className="text-14 opacity-80">{k.label}</p>
            <p className="mt-2 text-32 font-semibold leading-[1.2]">{k.value}</p>
          </div>
        ))}
      </section>

      {attends && (
        <section className="rounded-lg bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-muted">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-14 text-muted-foreground">Status hari ini</p>
                <p className="font-semibold">Belum absen · Jam kerja 09:00–17:00</p>
              </div>
            </div>
            <Button className="w-full sm:w-auto">Absen Masuk</Button>
          </div>
        </section>
      )}

      <section className="rounded-lg bg-card p-5">
        <h2 className="mb-3 font-semibold">Tugas harian</h2>
        <p className="rounded-md bg-muted p-6 text-center text-14 text-muted-foreground">
          Belum ada tugas.
        </p>
      </section>
    </div>
  );
}
