"use client";

import * as React from "react";
import type { Buckets } from "@/lib/cash";

// Warna tile solid (bukan gradient): rank 0 (saldo terbesar) = hijau aksen,
// sisanya grayscale terang→gelap sesuai urutan. ink = warna teks kontras.
function tileStyle(rank: number, n: number): { bg: string; ink: string } {
  if (rank === 0) return { bg: "#7CFF5B", ink: "#0a0a0a" };
  const t = (rank - 1) / Math.max(1, n - 2); // 0..1
  const L = Math.round(92 - t * 78); // 92% → 14%
  return { bg: `hsl(0 0% ${L}%)`, ink: L > 55 ? "#0a0a0a" : "#f5f5f5" };
}

// Label lokal (jangan import nilai dari @/lib/cash → menyeret prisma ke bundle client).
const BUCKET_LABEL: Record<keyof Buckets, string> = {
  cash: "Cash (laci)",
  mandiri: "EDC Mandiri",
  bca: "EDC BCA",
  bri: "EDC BRI",
};

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const compact = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "jt" : n >= 1000 ? Math.round(n / 1000) + "rb" : String(n);

const total = (b: Buckets) => b.cash + b.mandiri + b.bca + b.bri;

export type BranchCash = { id: string; name: string; opened: boolean; expected: Buckets; close: Buckets | null };
type Metric = keyof Buckets | "all";

type Rect = { i: number; v: number; x: number; y: number; w: number; h: number };
/** squarify treemap dalam ruang unit (tak perlu ukuran piksel). */
function squarify(vals: number[], X: number, Y: number, W: number, H: number): Rect[] {
  const tot = vals.reduce((a, b) => a + b, 0) || 1,
    scale = (W * H) / tot,
    out: Rect[] = [];
  let rest = vals.map((v, i) => ({ i, v, a: v * scale }));
  let x = X, y = Y, w = W, h = H;
  const worst = (row: typeof rest, len: number) => {
    const s = row.reduce((a, b) => a + b.a, 0), mx = Math.max(...row.map((r) => r.a)), mn = Math.min(...row.map((r) => r.a));
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
  };
  while (rest.length) {
    const len = Math.min(w, h);
    const row = [rest[0]];
    let k = 1;
    while (k < rest.length && worst([...row, rest[k]], len) <= worst(row, len)) row.push(rest[k++]);
    rest = rest.slice(k);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) { const cw = s / h; let cy = y; for (const r of row) { const rh = r.a / cw; out.push({ ...r, x, y: cy, w: cw, h: rh }); cy += rh; } x += cw; w -= cw; }
    else { const rh = s / w; let cx = x; for (const r of row) { const rw = r.a / rh; out.push({ ...r, x: cx, y, w: rw, h: rh }); cx += rw; } y += rh; h -= rh; }
  }
  return out;
}

export function BranchCashTreemap({ branches, children }: { branches: BranchCash[]; children?: React.ReactNode }) {
  const [metric, setMetric] = React.useState<Metric>("all");
  const valueOf = (b: BranchCash) => (metric === "all" ? total(b.expected) : b.expected[metric]);
  const mismatch = (b: BranchCash) =>
    b.close != null && (metric === "all" ? total(b.close) !== total(b.expected) : b.close[metric] !== b.expected[metric]);

  const rows = branches
    .map((b) => ({ b, v: valueOf(b) }))
    .filter((r) => r.v > 0)
    .sort((a, b) => b.v - a.v);
  const grand = rows.reduce((s, r) => s + r.v, 0);
  const rects = rows.length ? squarify(rows.map((r) => r.v), 0, 0, 100, 62) : [];

  const tabs: { key: Metric; label: string }[] = [
    { key: "all", label: "Total" },
    { key: "cash", label: "Cash" },
    { key: "mandiri", label: "Mandiri" },
    { key: "bca", label: "BCA" },
    { key: "bri", label: "BRI" },
  ];

  return (
    <section className="min-w-0 flex-1 rounded-2xl border bg-card p-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-16 font-semibold">Saldo Kasir per Cabang</h2>
          <p className="text-12 text-muted-foreground">
            {metric === "all" ? "Total saldo" : BUCKET_LABEL[metric]} hari ini · {rupiah(grand)}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-muted p-[3px]">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMetric(t.key)}
              className={`rounded-lg px-2.5 py-1 text-12 font-medium transition-colors ${metric === t.key ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-14 text-muted-foreground">Belum ada saldo cabang hari ini.</p>
      ) : (
        <div className="relative mt-4 h-[220px] w-full sm:h-[260px]">
          {rects.map((r) => {
            const { b } = rows[r.i];
            const share = ((r.v / grand) * 100).toFixed(r.v / grand < 0.1 ? 1 : 0);
            const { bg, ink } = tileStyle(r.i, rows.length);
            const big = r.w >= 22 && r.h >= 18;
            return (
              <div
                key={b.id}
                className="absolute flex flex-col justify-between overflow-hidden rounded-xl p-2.5"
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `calc(${r.w}% - 6px)`, height: `calc(${r.h}% - 6px)`, background: bg, color: ink }}
                title={`${b.name}: ${rupiah(r.v)} (${share}%)`}
              >
                <div className="flex items-center gap-1 text-12 leading-tight" style={{ opacity: 0.7 }}>
                  <span className="truncate">{b.name}</span>
                  {mismatch(b) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" title="Selisih" />}
                </div>
                <span className="font-semibold leading-none" style={{ fontSize: big ? 30 : 18 }}>{compact(r.v)}</span>
              </div>
            );
          })}
        </div>
      )}
      {children}
    </section>
  );
}
