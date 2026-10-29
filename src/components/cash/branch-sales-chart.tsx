"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalesTrends } from "@/lib/cash";

// Palet sama & urutan sama (name-sorted) dengan treemap → warna cabang konsisten.
const PALETTE = ["#7CFF5B", "#8B3DFF", "#FFB800", "#FF5A1F", "#22D3EE", "#FF3DA5", "#34D399", "#6366F1"];
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const compact = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "jt" : n >= 1000 ? Math.round(n / 1000) + "rb" : String(n);

type TipProps = { active?: boolean; label?: string; payload?: { dataKey?: string | number; value?: number; color?: string }[] };
function Tip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-2.5 py-1.5 text-12 shadow-xl">
      <div className="mb-1 font-medium">{label}</div>
      <div className="grid gap-1">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <i className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
              {String(p.dataKey)}
            </span>
            <b className="font-medium tabular-nums">{rupiah(Number(p.value ?? 0))}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

type Mode = "harian" | "bulanan" | "tahunan";

export function BranchSalesChart({ trends }: { trends: SalesTrends }) {
  const [mode, setMode] = React.useState<Mode>("bulanan");
  const { labels, series } = trends[mode];
  const data = labels.map((m, i) => {
    const row: Record<string, string | number> = { label: m };
    for (const s of series) row[s.name] = s.points[i];
    return row;
  });

  return (
    <section className="min-w-0 flex-1 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-16 font-semibold">Penjualan per Cabang</h2>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="shrink-0 rounded-lg border bg-background px-2 py-1 text-12"
          >
            <option value="harian">Harian</option>
            <option value="bulanan">Bulanan</option>
            <option value="tahunan">Tahunan</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-12 text-muted-foreground">
          {series.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <i className="h-0.5 w-3.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeOpacity={0.4} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
            <YAxis width={44} tickLine={false} axisLine={false} fontSize={10} stroke="currentColor" className="text-muted-foreground" tickFormatter={(v) => compact(Number(v))} />
            <Tooltip content={<Tip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
            {series.map((s, i) => (
              <Line key={s.id} dataKey={s.name} type="bump" stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={2} filter="url(#line-glow)" isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-11 text-muted-foreground">Total penjualan (grandTotal) per periode, per cabang.</p>
    </section>
  );
}
