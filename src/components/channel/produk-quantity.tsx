"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export type QtyRow = { key: string; sku: string; name: string; variant: string | null; img: string | null; price: number; per: Record<string, number>; other: number; total: number };

const LIMIT = 300;

export function ProdukQuantity({ rows, branches }: { rows: QtyRow[]; branches: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [filter, setFilter] = useState<"semua" | "ada" | "habis">("semua");
  const hasOther = rows.some((r) => r.other > 0);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const qty = (r: QtyRow) => (branch ? (r.per[branch] ?? 0) : r.total);
    return rows.filter(
      (r) =>
        (!s || r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s)) &&
        (filter === "semua" || (filter === "ada" ? qty(r) > 0 : qty(r) <= 0)),
    );
  }, [rows, q, branch, filter]);

  const sum = (id: string) => list.reduce((n, r) => n + (r.per[id] ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-60 flex-1 items-center gap-2 rounded-md border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / SKU" className="h-full w-full bg-transparent text-14 outline-none" />
        </label>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-14">
          <option value="">Semua cabang</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-10 rounded-md border bg-card px-3 text-14">
          <option value="semua">Semua stok</option>
          <option value="ada">Ada stok</option>
          <option value="habis">Habis</option>
        </select>
        <span className="text-14 text-muted-foreground">{list.length} barang</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3 font-normal">Barang</th>
              <th className="p-3 font-normal">SKU</th>
              {branches.map((b) => <th key={b.id} className={`p-3 text-right font-normal ${branch === b.id ? "text-foreground" : ""}`}>{b.name}</th>)}
              {hasOther && <th className="p-3 text-right font-normal" title="Gudang yang belum dipetakan ke cabang">Lainnya</th>}
              <th className="p-3 text-right font-semibold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr:last-child]:border-b-0">
            {list.slice(0, LIMIT).map((r) => (
              <tr key={r.key}>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    {r.img ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                      <img src={r.img} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border object-cover" />
                    ) : (
                      <span className="size-10 shrink-0 rounded-md border bg-muted" />
                    )}
                    <span className="min-w-0">{r.name}</span>
                  </span>
                </td>
                <td className="p-3 font-mono text-12 whitespace-nowrap">{r.sku}</td>
                {branches.map((b) => {
                  const n = r.per[b.id] ?? 0;
                  return <td key={b.id} className={`p-3 text-right tabular-nums ${n <= 0 ? "text-muted-foreground" : ""} ${branch === b.id ? "font-semibold" : ""}`}>{n}</td>;
                })}
                {hasOther && <td className="p-3 text-right tabular-nums text-muted-foreground">{r.other}</td>}
                <td className={`p-3 text-right font-semibold tabular-nums ${r.total <= 0 ? "text-destructive" : ""}`}>{r.total}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={branches.length + 4} className="p-6 text-center text-muted-foreground">Tidak ada barang.</td></tr>
            )}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="p-3" colSpan={2}>Jumlah</td>
                {branches.map((b) => <td key={b.id} className="p-3 text-right tabular-nums">{sum(b.id)}</td>)}
                {hasOther && <td className="p-3 text-right tabular-nums">{list.reduce((n, r) => n + r.other, 0)}</td>}
                <td className="p-3 text-right tabular-nums">{list.reduce((n, r) => n + r.total, 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {list.length > LIMIT && <p className="text-14 text-muted-foreground">Menampilkan {LIMIT} dari {list.length}. Persempit dengan pencarian.</p>}
    </div>
  );
}
