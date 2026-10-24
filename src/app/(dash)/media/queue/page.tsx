import { requireMedia } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { STAGES, IDX, POSTED, TYPES, CATLBL, isOff, toT, addDays, workBetween } from "@/lib/media/schedule";
import { isExpired, late, ready } from "@/lib/media/card";
import { todayWIB } from "@/server/media/schedule-runner";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fmt = (s: string) => {
  const d = new Date(s + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
};

export default async function MediaQueuePage() {
  await requireMedia();
  const today = todayWIB();
  const [rawTasks, items] = await Promise.all([prisma.mediaTask.findMany(), prisma.mediaItem.findMany()]);
  const tasks = rawTasks
    .map((t) => ({ ...t, metaAtMs: t.metaAt ? t.metaAt.getTime() : 0 }))
    .filter((t) => !isExpired({ id: t.id, status: t.status, createdAt: t.createdAt.getTime(), type: t.type, title: t.title }, today));
  const sched = (t: { status: string; metaAtMs: number }) => t.status === "Tayang" || (t.status === "Ready" && !!t.metaAtMs);

  const op = tasks.filter((t) => !ready({ status: t.status }));
  const overdue = op.filter((t) => late({ status: t.status, due: t.due }, today)).sort((a, b) => (a.due || "").localeCompare(b.due || ""));
  const soon = op.filter((t) => !late({ status: t.status, due: t.due }, today) && t.due && workBetween(today, t.due) <= 3);
  const wk = addDays(today, -7);
  const recent = tasks.filter((t) => t.readyAt && t.readyAt > wk);
  const onTime = recent.filter((t) => t.due && t.readyAt! <= t.due).length;
  const pct = recent.length ? Math.round((onTime / recent.length) * 100) : null;
  const newItems = items.filter((i) => i.arrived.toISOString().slice(0, 10) > wk).length;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    return { d, n: tasks.filter((t) => POSTED.includes(t.type) && t.postAt === d && sched(t)).length, off: isOff(toT(d)) };
  });
  const stageCount = STAGES.slice(0, 4).map((s) => ({ s, n: tasks.filter((t) => t.status === s).length }));

  // watchlist: per barang, konten + status
  const byItem = new Map<string, typeof tasks>();
  tasks.forEach((t) => {
    const k = t.itemId || t.title;
    byItem.set(k, [...(byItem.get(k) || []), t]);
  });

  return (
    <div className="space-y-5">
      <h1 className="text-24 font-semibold">Content Queue</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi n={overdue.length} label="lewat batas" tone={overdue.length ? "bad" : "good"} />
        <Kpi n={soon.length} label="jatuh tempo ≤3 hari" tone={soon.length ? "warn" : ""} />
        <Kpi n={pct == null ? "–" : `${pct}%`} label="tepat waktu (7 hari)" tone={pct == null ? "" : pct >= 80 ? "good" : "warn"} />
        <Kpi n={`${days.filter((x) => x.n >= 4).length}/7`} label="hari penuh (4 posting)" tone="" />
        <Kpi n={newItems} label="barang baru (7 hari)" tone="" />
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-14 font-medium">Stok konten terjadwal, 7 hari ke depan</h2>
        <div className="grid grid-cols-7 gap-2">
          {days.map((x) => (
            <div key={x.d} className={`rounded-md border p-2 text-center ${x.off ? "opacity-50" : ""}`}>
              <p className="text-11 text-muted-foreground">{fmt(x.d).split(" ").slice(0, 2).join(" ")}</p>
              <p className="text-20 font-semibold">{x.n}</p>
              <p className="text-10 text-muted-foreground">{x.off ? "tim libur" : "dari 4"}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-14 font-medium">Lewat batas waktu</h2>
          {overdue.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Tidak ada yang terlambat.</p>
          ) : (
            <ul className="space-y-1 text-14">
              {overdue.slice(0, 12).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{TYPES[t.type]?.label} · {t.title}</span>
                  <span className="shrink-0 text-11 text-red-600">{t.status} · {t.due ? fmt(t.due) : "-"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-14 font-medium">Jumlah konten per tahap</h2>
          <div className="space-y-2">
            {stageCount.map((x) => (
              <div key={x.s} className="flex items-center gap-2 text-14">
                <span className="w-24 shrink-0">{x.s}</span>
                <div className="h-2 flex-1 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, (x.n / Math.max(1, ...stageCount.map((y) => y.n))) * 100)}%` }} />
                </div>
                <span className="w-6 text-right">{x.n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-14 font-medium">Watchlist semua barang ({byItem.size})</h2>
        <div className="space-y-2">
          {[...byItem.entries()].map(([k, ts]) => {
            const first = ts[0];
            return (
              <div key={k} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                <div className="min-w-[160px] flex-1">
                  <p className="font-medium">{first.title}</p>
                  <p className="text-11 text-muted-foreground">{first.cat ? CATLBL[first.cat] ?? first.cat : ""}{first.source === "lama" ? " · stok lama" : ""}</p>
                </div>
                <div className="flex flex-wrap gap-1 text-11">
                  {ts.sort((a, b) => (TYPES[a.type]?.prio ?? 9) - (TYPES[b.type]?.prio ?? 9)).map((t) => (
                    <span key={t.id} className={`rounded px-1.5 py-0.5 ${sched(t) ? "bg-green-100 text-green-800" : late({ status: t.status, due: t.due }, today) ? "bg-red-100 text-red-700" : "bg-muted"}`}>
                      {TYPES[t.type]?.label}: {IDX[t.status] >= IDX["Ready"] && sched(t) ? "Tayang" : t.status}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {byItem.size === 0 && <p className="py-6 text-center text-muted-foreground">Belum ada konten.</p>}
        </div>
      </section>
    </div>
  );
}

function Kpi({ n, label, tone }: { n: number | string; label: string; tone: "good" | "warn" | "bad" | "" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-green-600" : "";
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-24 font-semibold ${color}`}>{n}</p>
      <p className="text-11 text-muted-foreground">{label}</p>
    </div>
  );
}
