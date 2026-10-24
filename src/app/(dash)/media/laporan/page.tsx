import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { PEOPLE, NAMES, IDX, POSTED, STAGES } from "@/lib/media/schedule";
import { isExpired, late } from "@/lib/media/card";
import { todayWIB } from "@/server/media/schedule-runner";
import { addDays } from "@/lib/media/schedule";

export default async function MediaLaporanPage() {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.full) {
    return <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">Laporan hanya untuk admin penuh.</p>;
  }

  const today = todayWIB();
  const wk = addDays(today, -7);
  const rows = await prisma.mediaTask.findMany();
  const tasks = rows.filter((t) => !isExpired({ id: t.id, status: t.status, createdAt: t.createdAt.getTime(), type: t.type, title: t.title }, today));
  const sched = (t: { status: string; metaAt: Date | null }) => t.status === "Tayang" || (t.status === "Ready" && !!t.metaAt);

  const readyWeek = tasks.filter((t) => t.readyAt && t.readyAt > wk);
  const onTime = readyWeek.filter((t) => t.due && t.readyAt! <= t.due).length;
  const pct = readyWeek.length ? Math.round((onTime / readyWeek.length) * 100) : null;
  const postedWeek = tasks.filter((t) => POSTED.includes(t.type) && t.postAt && t.postAt > wk && t.postAt <= today && sched(t)).length;
  const overdue = tasks.filter((t) => late({ status: t.status, due: t.due }, today)).length;

  const load = PEOPLE.map((p) => {
    const prod = tasks.filter((t) => t.producer === p && IDX[t.status] <= 0).length;
    const edit = tasks.filter((t) => t.editor === p && (t.status === "Diproduksi" || t.status === "Editing")).length;
    const scr = tasks.filter((t) => t.script === p && t.status === "Terdata").length;
    const tal = tasks.filter((t) => t.talent === p && IDX[t.status] <= 0).length;
    const qc = p === "Z" ? tasks.filter((t) => t.status === "Ready" && !t.metaAt).length : 0;
    return { p, prod, edit, scr, tal, qc, tot: prod + edit + scr + tal + qc };
  });
  const stageCount = STAGES.map((s) => ({ s, n: tasks.filter((t) => t.status === s).length }));

  return (
    <div className="space-y-5">
      <h1 className="text-24 font-semibold">Laporan Admin</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi n={readyWeek.length} label="konten siap (7 hari)" />
        <Kpi n={pct == null ? "–" : `${pct}%`} label="tepat waktu (7 hari)" />
        <Kpi n={postedWeek} label="tayang (7 hari)" />
        <Kpi n={overdue} label="lewat batas" bad={overdue > 0} />
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-14 font-medium">Beban kerja per orang (konten aktif)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-14">
            <thead>
              <tr className="text-left text-12 text-muted-foreground">
                <th className="py-1">Orang</th><th>Syuting</th><th>Edit</th><th>Skrip</th><th>Talent</th><th>Cek/QC</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {load.map((l) => (
                <tr key={l.p} className="border-t">
                  <td className="py-1 font-medium">{NAMES[l.p]}</td>
                  <td>{l.prod}</td><td>{l.edit}</td><td>{l.scr}</td><td>{l.tal}</td><td>{l.qc}</td>
                  <td className="font-semibold">{l.tot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-14 font-medium">Jumlah konten per tahap</h2>
        <div className="flex flex-wrap gap-3">
          {stageCount.map((x) => (
            <div key={x.s} className="rounded-md border px-3 py-2 text-center">
              <p className="text-20 font-semibold">{x.n}</p>
              <p className="text-11 text-muted-foreground">{x.s}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ n, label, bad }: { n: number | string; label: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-24 font-semibold ${bad ? "text-red-600" : ""}`}>{n}</p>
      <p className="text-11 text-muted-foreground">{label}</p>
    </div>
  );
}
