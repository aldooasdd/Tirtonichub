"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { pemakaiSku, simpanStok } from "@/server/actions/rfid";

export type QtyRow = { key: string; sku: string; name: string; variant: string | null; img: string | null; price: number; per: Record<string, number>; other: number; total: number };

type Cabang = { id: string; name: string; bisa: boolean }; // bisa = punya gudang marketplace

const LIMIT = 300;

/** Ubah stok 1 barang per cabang → langsung ke Shopee & Tokopedia + Produk Master. */
function UbahStok({ row, branches, fokus, onDone }: { row: QtyRow; branches: Cabang[]; fokus: string; onDone: (msg: string | null) => void }) {
  const cabang = branches.filter((b) => b.bisa);
  const belum = branches.filter((b) => !b.bisa);
  const awal = (id: string) => String(row.per[id] ?? 0);
  const [val, setVal] = useState<Record<string, string>>(() => Object.fromEntries(cabang.map((b) => [b.id, awal(b.id)])));
  const [pakai, setPakai] = useState<string[] | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    let on = true;
    pemakaiSku(row.sku).then((r) => on && setPakai(r)).catch(() => on && setErr("Gagal memuat daftar listing. Tutup lalu buka lagi."));
    return () => { on = false; };
  }, [row.sku]);
  const ubah = cabang.filter((b) => val[b.id] !== awal(b.id));
  const salah = ubah.some((b) => !/^\d{1,4}$/.test(val[b.id]));
  const simpan = () => {
    if (pending || !pakai || !ubah.length || salah) return;
    start(async () => {
      try {
        const r = await simpanStok(row.sku, ubah.map((b) => ({ branchId: b.id, stock: Number(val[b.id]) })));
        if (r.ok) onDone(`${row.name}: ${r.message}`);
        else setErr(r.message);
      } catch {
        setErr("Gagal. Cek koneksi, muat ulang, lalu periksa stoknya sebelum mengulang.");
      }
    });
  };
  return (
    <div className="space-y-3 bg-muted/40 p-3">
      <div className="flex flex-wrap gap-3">
        {cabang.map((b) => (
          <label key={b.id} className="flex flex-col gap-1 text-12 text-muted-foreground">
            {b.name} (sekarang {awal(b.id)})
            <input
              autoFocus={b.id === fokus}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              value={val[b.id]}
              disabled={pending}
              onChange={(e) => setVal((v) => ({ ...v, [b.id]: e.target.value.trim() }))}
              onKeyDown={(e) => { if (e.key === "Enter") simpan(); if (e.key === "Escape" && !pending) onDone(null); }}
              className="h-10 w-32 rounded-md border bg-background px-3 text-14 text-foreground"
            />
          </label>
        ))}
      </div>
      {belum.length > 0 && <p className="text-12 text-warning">{belum.map((b) => b.name).join(", ")} belum punya gudang. Pilih gudangnya di Tirtonic POS → Per cabang.</p>}
      {salah && <p className="text-12 text-destructive">Stok harus angka 0–9999.</p>}
      <div className="text-12 text-muted-foreground">
        Langsung mengubah stok di Shopee & Tokopedia (tirtonic.com menyusul lewat sinkron) untuk:
        <ul className="list-disc pl-5">{pakai ? pakai.map((x, i) => <li key={i}>{x}</li>) : <li>Memuat…</li>}</ul>
      </div>
      {err && <p role="alert" className="text-14 text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={simpan} disabled={pending || !pakai || !ubah.length || salah} className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-40">{pending ? "Menyimpan…" : "Simpan stok"}</button>
        <button type="button" onClick={() => onDone(null)} disabled={pending} className="h-9 rounded-md border px-4 disabled:opacity-40">Tutup</button>
      </div>
    </div>
  );
}

export function ProdukQuantity({ rows, branches }: { rows: QtyRow[]; branches: Cabang[] }) {
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [filter, setFilter] = useState<"semua" | "ada" | "habis">("semua");
  const [edit, setEdit] = useState<{ key: string; fokus: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
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

      {msg && <p role="status" className="rounded-md bg-muted px-3 py-2 text-14">{msg}</p>}

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
              <Fragment key={r.key}>
              <tr>
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
                  return <td key={b.id} className={`p-3 text-right tabular-nums ${n <= 0 ? "text-muted-foreground" : ""} ${branch === b.id ? "font-semibold" : ""}`}>
                    <button type="button" aria-label={`Ubah stok ${b.name} ${r.name}`} onClick={() => { setMsg(null); setEdit({ key: r.key, fokus: b.id }); }} className="min-w-10 rounded-md border px-2 py-1 text-right hover:bg-muted">{n}</button>
                  </td>;
                })}
                {hasOther && <td className="p-3 text-right tabular-nums text-muted-foreground">{r.other}</td>}
                <td className={`p-3 text-right font-semibold tabular-nums ${r.total <= 0 ? "text-destructive" : ""}`}>{r.total}</td>
              </tr>
              {edit?.key === r.key && (
                <tr>
                  <td colSpan={branches.length + (hasOther ? 4 : 3)} className="p-0">
                    <UbahStok row={r} branches={branches} fokus={edit.fokus} onDone={(m) => { setEdit(null); setMsg(m); }} />
                  </td>
                </tr>
              )}
              </Fragment>
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
