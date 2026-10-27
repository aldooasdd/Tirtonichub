"use client";

import { useState } from "react";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

export type PenjualanRow = {
  key: string;
  dateKey: string; // YYYY-MM-DD (WIB) utk filter
  pelanggan: string;
  nama: string;
  qty: number;
  jual: number;
  cash: number;
  saluran: string;
  ket: string;
  photoKey: string;
  first: boolean;
};

const todayWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export function PenjualanTable({ rows }: { rows: PenjualanRow[] }) {
  const [tgl, setTgl] = useState(todayWIB); // default: hari ini (WIB)
  const shown = tgl ? rows.filter((r) => r.dateKey === tgl) : rows;
  const total = shown.reduce((s, r) => s + r.jual, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Penjualan</h1>
          <p className="text-14 text-muted-foreground">Offline dari nota Sales. Online diinput Admin (marketplace).</p>
        </div>
        <p className="text-14 font-semibold shrink-0">{rupiah(total)} <span className="text-12 font-normal text-muted-foreground">· {shown.length} baris</span></p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-12 text-muted-foreground">Cari tanggal</label>
        <input
          type="date"
          value={tgl}
          onChange={(e) => setTgl(e.target.value)}
          className="rounded-md border bg-card px-2 py-1 text-14"
        />
        {tgl && (
          <button onClick={() => setTgl("")} className="text-12 text-primary">
            Semua
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
          {tgl ? "Tidak ada penjualan di tanggal ini." : "Belum ada penjualan."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14 border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-12 text-muted-foreground">
                <th className="px-3 py-2 font-medium">Pelanggan</th>
                <th className="px-3 py-2 font-medium">Nama Barang</th>
                <th className="px-3 py-2 font-medium text-right">Kuantitas</th>
                <th className="px-3 py-2 font-medium text-right">Penjualan</th>
                <th className="px-3 py-2 font-medium text-right">Cash</th>
                <th className="px-3 py-2 font-medium">Saluran</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2">{r.pelanggan}</td>
                  <td className="px-3 py-2">{r.nama}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{rupiah(r.jual)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.cash ? rupiah(r.cash) : ""}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-11">{r.saluran}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.first && (
                      <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-12 text-primary">Nota</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
