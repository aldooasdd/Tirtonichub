"use client";

import { useMemo, useState } from "react";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

export type NotaItem = { name: string; qty: number; jual: number; cash: number };
export type NotaRow = {
  id: string;
  dateKey: string; // YYYY-MM-DD (WIB) utk filter
  tgl: string; // tampilan
  customer: string;
  branch: string;
  saluran: string;
  grandTotal: number;
  photoKey: string;
  items: NotaItem[];
};

const todayWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export function PenjualanTable({ notas }: { notas: NotaRow[] }) {
  const [tgl, setTgl] = useState(todayWIB); // default: hari ini (WIB)
  const [cabang, setCabang] = useState(""); // "" = semua

  const cabangOpts = useMemo(
    () => Array.from(new Set(notas.map((n) => n.branch).filter((b) => b && b !== "-"))).sort(),
    [notas],
  );

  const shown = notas.filter((n) => (!tgl || n.dateKey === tgl) && (!cabang || n.branch === cabang));
  const total = shown.reduce((s, n) => s + n.grandTotal, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Penjualan</h1>
          <p className="text-14 text-muted-foreground">Offline dari nota Sales. Online diinput Admin (marketplace).</p>
        </div>
        <p className="text-14 font-semibold shrink-0">{rupiah(total)} <span className="text-12 font-normal text-muted-foreground">· {shown.length} nota</span></p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-12 text-muted-foreground">Tanggal</label>
          <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} className="rounded-md border bg-card px-2 py-1 text-14" />
          {tgl && <button onClick={() => setTgl("")} className="text-12 text-primary">Semua</button>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-12 text-muted-foreground">Cabang</label>
          <select value={cabang} onChange={(e) => setCabang(e.target.value)} className="rounded-md border bg-card px-2 py-1 text-14">
            <option value="">Semua</option>
            {cabangOpts.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">Tidak ada penjualan.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((n) => (
            <div key={n.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{n.customer}</p>
                  <p className="text-12 text-muted-foreground">
                    {n.tgl} · {n.branch} · <span className="rounded-full bg-muted px-2 py-0.5 text-11">{n.saluran}</span>
                    {" · "}
                    <a href={`/api/file?key=${encodeURIComponent(n.photoKey)}`} target="_blank" rel="noopener" className="text-primary">Lihat nota</a>
                  </p>
                </div>
                <p className="shrink-0 text-14 font-semibold">{rupiah(n.grandTotal)}</p>
              </div>
              <table className="w-full text-14 border-collapse">
                <thead>
                  <tr className="border-b text-left text-12 text-muted-foreground">
                    <th className="px-4 py-1.5 font-medium">Nama Barang</th>
                    <th className="px-4 py-1.5 font-medium text-right">Kuantitas</th>
                    <th className="px-4 py-1.5 font-medium text-right">Penjualan</th>
                    <th className="px-4 py-1.5 font-medium text-right">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {n.items.map((it, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-1.5">{it.name}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{it.qty}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums font-medium">{rupiah(it.jual)}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{it.cash ? rupiah(it.cash) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
