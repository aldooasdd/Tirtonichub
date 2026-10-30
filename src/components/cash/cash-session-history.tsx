"use client";

import * as React from "react";
import type { CashSessionRow, Buckets } from "@/lib/cash";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const total = (b: Buckets) => b.cash + b.mandiri + b.bca + b.bri;
const jam = (d: Date) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(d));
const tgl = (d: Date) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(d));

const PREVIEW = 3; // baris per cabang sebelum "lihat semua"

export function CashSessionHistory({ rows }: { rows: CashSessionRow[] }) {
  const [all, setAll] = React.useState(false);

  // Kelompokkan per cabang, urutan cabang ikut kemunculan pertama (terbaru dulu sudah dari loader).
  const groups = new Map<string, { name: string; rows: CashSessionRow[] }>();
  for (const r of rows) {
    const g = groups.get(r.branchId) ?? { name: r.branch, rows: [] };
    g.rows.push(r);
    groups.set(r.branchId, g);
  }
  const branches = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h2 className="text-14 font-semibold">Riwayat Buka / Tutup Kasir</h2>
      <p className="text-12 text-muted-foreground">Per cabang · 1 orang buka &amp; wajib tutup tiap shift</p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-14 text-muted-foreground">Belum ada data buka kasir.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          {branches.map((b) => {
            const shown = all ? b.rows : b.rows.slice(0, PREVIEW);
            return (
              <div key={b.name}>
                <h3 className="text-13 font-semibold text-muted-foreground">{b.name}</h3>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full border-collapse text-14">
                    <thead>
                      <tr className="text-12 text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Tgl</th>
                        <th className="pb-2 text-left font-medium">Buka</th>
                        <th className="pb-2 text-left font-medium">Oleh</th>
                        <th className="pb-2 text-right font-medium">Saldo buka</th>
                        <th className="pb-2 text-left font-medium">Tutup</th>
                        <th className="pb-2 text-left font-medium">Oleh</th>
                        <th className="pb-2 text-right font-medium">Saldo tutup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.id} className="border-t align-top">
                          <td className="py-2 whitespace-nowrap text-muted-foreground">{tgl(r.date)}</td>
                          <td className="py-2 whitespace-nowrap text-emerald-600">{jam(r.openAt)}</td>
                          <td className="py-2">{r.openBy}</td>
                          <td className="py-2 text-right font-semibold whitespace-nowrap">{rupiah(total(r.open))}</td>
                          {r.closeAt ? (
                            <>
                              <td className="py-2 whitespace-nowrap text-destructive">{jam(r.closeAt)}</td>
                              <td className="py-2">{r.closeBy}</td>
                              <td className="py-2 text-right font-semibold whitespace-nowrap">{rupiah(total(r.close!))}</td>
                            </>
                          ) : (
                            <td className="py-2 text-amber-600" colSpan={3}>Belum ditutup</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {branches.some((b) => b.rows.length > PREVIEW) && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="w-full rounded-lg border py-2 text-12 font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {all ? "Tampilkan lebih sedikit" : "Lihat semua"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
