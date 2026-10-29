"use client";

import * as React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { SalesTrends } from "@/lib/cash";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const compact = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "jt" : n >= 1000 ? Math.round(n / 1000) + "rb" : String(n);

type Mode = "harian" | "bulanan" | "tahunan";
const LINE = "#22c55e";

type TipProps = { active?: boolean; label?: string; payload?: { value?: number }[] };
function Tip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-2.5 py-1.5 text-12 shadow-xl">
      <div className="text-muted-foreground">{label}</div>
      <b className="font-medium tabular-nums">{rupiah(Number(payload[0].value ?? 0))}</b>
    </div>
  );
}

export function TotalSalesChart({ trends }: { trends: SalesTrends }) {
  const [mode, setMode] = React.useState<Mode>("bulanan");
  const { labels, series } = trends[mode];
  const totals = labels.map((_, i) => series.reduce((s, b) => s + (b.points[i] ?? 0), 0));
  const data = labels.map((l, i) => ({ label: l, total: totals[i] }));

  const last = totals[totals.length - 1] ?? 0;
  const prev = totals[totals.length - 2] ?? 0;
  const delta = prev > 0 ? ((last - prev) / prev) * 100 : null;
  const up = delta == null || delta >= 0;

  const tabs: { key: Mode; label: string }[] = [
    { key: "harian", label: "Harian" },
    { key: "bulanan", label: "Bulanan" },
    { key: "tahunan", label: "Tahunan" },
  ];

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-12 text-muted-foreground">Total Penjualan Semua Cabang</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-24 font-semibold tabular-nums">{rupiah(last)}</span>
            {delta != null && (
              <span className={`text-12 font-semibold ${up ? "text-emerald-500" : "text-destructive"}`}>
                {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="inline-flex rounded-xl bg-muted p-[3px]">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              className={`rounded-lg px-2.5 py-1 text-12 font-medium transition-colors ${mode === t.key ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="total-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
            <YAxis width={44} tickLine={false} axisLine={false} fontSize={10} stroke="currentColor" className="text-muted-foreground" tickFormatter={(v) => compact(Number(v))} />
            <Tooltip content={<Tip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
            <Area type="monotone" dataKey="total" stroke={LINE} strokeWidth={2} fill="url(#total-fill)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-11 text-muted-foreground">Jumlah penjualan (grandTotal) semua cabang per periode.</p>
    </section>
  );
}
