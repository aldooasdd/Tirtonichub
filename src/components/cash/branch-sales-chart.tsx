import type { SalesTrend } from "@/lib/cash";

// Palet sama & urutan sama (name-sorted) dengan treemap → warna cabang konsisten.
const PALETTE = ["#7CFF5B", "#8B3DFF", "#FFB800", "#FF5A1F", "#22D3EE", "#FF3DA5", "#34D399", "#6366F1"];
const compact = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "jt" : n >= 1000 ? Math.round(n / 1000) + "rb" : String(n);

const W = 600, H = 300, PL = 46, PR = 14, PT = 16, PB = 28;

/** Catmull-rom → kurva mulus. */
function smooth(P: [number, number][]) {
  if (P.length < 2) return P.length ? `M${P[0][0]},${P[0][1]}` : "";
  const g = (i: number) => P[Math.max(0, Math.min(P.length - 1, i))];
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), k = 0.2;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function BranchSalesChart({ trend }: { trend: SalesTrend }) {
  const { months, series } = trend;
  const n = months.length;
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  // Skala Y "cantik": bulatkan max ke atas.
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / mag) * mag;
  const X = (i: number) => PL + (i / Math.max(1, n - 1)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - v / niceMax) * (H - PT - PB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * niceMax);

  return (
    <section className="min-w-0 flex-1 rounded-2xl border bg-card p-5">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <h2 className="text-16 font-semibold">Penjualan per Cabang (6 bulan)</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-12 text-muted-foreground">
          {series.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <i className="h-0.5 w-3.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Tren penjualan per cabang">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={PL - 6} y={Y(v) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">{compact(v)}</text>
          </g>
        ))}
        {months.map((m, i) => (
          <text key={m + i} x={X(i)} y={H - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground">{m}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.points.map((v, i) => [X(i), Y(v)] as [number, number]);
          const color = PALETTE[si % PALETTE.length];
          const last = pts[pts.length - 1];
          return (
            <g key={s.id}>
              <path d={smooth(pts)} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-11 text-muted-foreground">Total penjualan (grandTotal) per bulan, per cabang.</p>
    </section>
  );
}
