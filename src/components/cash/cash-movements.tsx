"use client";

import * as React from "react";
import type { CashMovement, Buckets } from "@/lib/cash";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const BUCKET: Record<keyof Buckets, string> = { cash: "Cash", mandiri: "Mandiri", bca: "BCA", bri: "BRI" };
const jam = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(d));
const dayKeyWIB = (d: Date) => new Date(new Date(d).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const todayWIB = () => dayKeyWIB(new Date());

const PREVIEW = 5;

export function CashMovements({ rows }: { rows: CashMovement[] }) {
  const [all, setAll] = React.useState(false);
  const [day, setDay] = React.useState(todayWIB); // default hari ini; "" = semua

  const filtered = day ? rows.filter((r) => dayKeyWIB(r.at) === day) : rows;
  const shown = all ? filtered : filtered.slice(0, PREVIEW);

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-14 font-semibold">Riwayat Uang Masuk / Keluar</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => { setDay(e.target.value); setAll(false); }}
            className="rounded-lg border bg-background px-2 py-1 text-12"
            aria-label="Filter tanggal"
          />
          {day && (
            <button type="button" onClick={() => setDay("")} className="text-12 text-muted-foreground underline">
              Semua
            </button>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-14 text-muted-foreground">{day ? "Tak ada transaksi di tanggal ini." : "Belum ada transaksi."}</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-14">
              <thead>
                <tr className="text-12 text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Jam</th>
                  <th className="pb-2 text-left font-medium">Cabang</th>
                  <th className="pb-2 text-left font-medium">Keterangan</th>
                  <th className="pb-2 text-left font-medium">Uang</th>
                  <th className="pb-2 text-right font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 text-muted-foreground">{jam(r.at)}</td>
                    <td className="py-2">{r.branch}</td>
                    <td className="py-2">
                      <span className={r.kind === "in" ? "text-emerald-600" : "text-destructive"}>
                        {r.kind === "in" ? "Penjualan" : "Pembelian"}
                      </span>
                      <span className="text-muted-foreground"> · {r.note}</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{BUCKET[r.bucket]}</td>
                    <td className={`py-2 text-right font-semibold ${r.kind === "in" ? "text-emerald-600" : "text-destructive"}`}>
                      {r.kind === "in" ? "+" : "−"}
                      {rupiah(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="mt-3 w-full rounded-lg border py-2 text-12 font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {all ? "Tampilkan lebih sedikit" : `Lihat semua (${filtered.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
