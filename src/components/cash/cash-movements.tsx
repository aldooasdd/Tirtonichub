"use client";

import * as React from "react";
import type { CashMovement, Buckets } from "@/lib/cash";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const BUCKET: Record<keyof Buckets, string> = { cash: "Cash", mandiri: "Mandiri", bca: "BCA", bri: "BRI" };
const jam = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(d));

const PREVIEW = 5;

export function CashMovements({ rows }: { rows: CashMovement[] }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);

  return (
    <div className="mt-5 border-t pt-4">
      <h2 className="text-14 font-semibold">Riwayat Uang Masuk / Keluar (hari ini)</h2>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-14 text-muted-foreground">Belum ada transaksi hari ini.</p>
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
          {rows.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="mt-3 w-full rounded-lg border py-2 text-12 font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {all ? "Tampilkan lebih sedikit" : `Lihat semua (${rows.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
