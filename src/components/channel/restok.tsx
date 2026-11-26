"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cariBarang, lookupSku, tambahStok, type Barang } from "@/server/actions/rfid";

type Baris = { sku: string; name: string; image: string | null; now: Record<string, number>; qty: string };
type Cabang = { id: string; label: string; bisa: boolean };

export function Restok({ cabang }: { cabang: Cabang[] }) {
  const pilihan = cabang.filter((c) => c.bisa);
  const [branch, setBranch] = useState(() => (pilihan.find((c) => /jogja|yogya/i.test(c.label)) ?? pilihan[0])?.id ?? "");
  const [rows, setRows] = useState<Baris[]>([]);
  const [hasil, setHasil] = useState<Barang[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cari, startCari] = useTransition();
  const [simpan, startSimpan] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const tambah = async (sku: string) => {
    const ada = rows.find((r) => r.sku.toLowerCase() === sku.toLowerCase());
    if (ada) return setRows((rs) => rs.map((r) => (r === ada ? { ...r, qty: String((Number(r.qty) || 0) + 1) } : r)));
    const s = await lookupSku(sku);
    if (!s.name) return false;
    const now = Object.fromEntries(s.cabang.map((c) => [c.id, c.stock ?? 0]));
    setRows((rs) => (rs.some((r) => r.sku.toLowerCase() === s.sku.toLowerCase()) ? rs : [{ sku: s.sku, name: s.variant ? `${s.name} · ${s.variant}` : s.name!, image: s.image, now, qty: "1" }, ...rs]));
  };

  const kirim = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setMsg(null);
    startCari(async () => {
      try {
        if ((await tambah(q)) === false) {
          const r = (await cariBarang(q)).filter((b) => b.skus.length);
          setHasil(r);
          if (!r.length) setMsg({ ok: false, text: `"${q}" tidak ketemu. Barang tanpa SKU belum bisa direstok — isi SKU-nya dulu.` });
        } else setHasil(null);
        if (input.current) input.current.value = "";
      } catch {
        setMsg({ ok: false, text: "Gagal mencari. Cek koneksi lalu coba lagi." });
      }
    });
  };

  const salah = rows.some((r) => !/^\d{1,4}$/.test(r.qty) || Number(r.qty) < 1);
  const save = () => {
    if (simpan || !rows.length || salah || !branch) return;
    startSimpan(async () => {
      try {
        const r = await tambahStok(branch, rows.map((x) => ({ sku: x.sku, qty: Number(x.qty) })));
        setMsg({ ok: r.ok, text: r.message });
        if (r.ok) setRows([]);
      } catch {
        setMsg({ ok: false, text: "Gagal. Cek koneksi, lalu periksa stoknya di Stok Gudang sebelum mengulang." });
      }
    });
  };

  if (!pilihan.length) return <p className="text-14 text-warning">Belum ada cabang yang punya gudang marketplace. Pilih gudangnya di Tirtonic POS → Per cabang.</p>;
  const nama = pilihan.find((c) => c.id === branch)?.label;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={branch} onChange={(e) => setBranch(e.target.value)} disabled={simpan} className="h-10 rounded-md border bg-card px-3 text-14">
          {pilihan.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input
          ref={input}
          autoFocus
          placeholder="Scan barcode / ketik SKU atau nama barang, lalu Enter"
          onKeyDown={(e) => { if (e.key === "Enter") kirim(e.currentTarget.value); }}
          disabled={simpan}
          className="h-10 min-w-60 flex-1 rounded-md border bg-card px-3 text-14"
        />
        {cari && <span className="self-center text-14 text-muted-foreground">Mencari…</span>}
      </div>

      {hasil && hasil.length > 0 && (
        <div className="rounded-lg border bg-card p-2 text-14">
          <p className="px-2 pb-1 text-12 text-muted-foreground">Pilih barang:</p>
          {hasil.map((b) => b.skus.map((s) => (
            <button key={b.id + s} type="button" onClick={() => kirim(s)} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
              {b.name}{b.variant ? ` · ${b.variant}` : ""} <span className="font-mono text-12 text-muted-foreground">{s}</span>
            </button>
          )))}
        </div>
      )}

      {msg && <p role="status" className={`rounded-md px-3 py-2 text-14 ${msg.ok ? "bg-muted" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-normal">Barang</th>
                <th className="p-3 text-right font-normal">Stok {nama} sekarang</th>
                <th className="p-3 text-right font-normal">Masuk</th>
                <th className="p-3 text-right font-normal">Jadi</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr:last-child]:border-b-0">
              {rows.map((r) => {
                const now = r.now[branch] ?? 0;
                return (
                  <tr key={r.sku}>
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                          <img src={r.image} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
                        ) : <span className="size-10 shrink-0 rounded-md border bg-muted" />}
                        <span className="min-w-0">{r.name}<span className="block font-mono text-12 text-muted-foreground">{r.sku}</span></span>
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{now}</td>
                    <td className="p-3 text-right">
                      <input
                        inputMode="numeric"
                        aria-label={`Jumlah masuk ${r.name}`}
                        value={r.qty}
                        disabled={simpan}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setRows((rs) => rs.map((x) => (x === r ? { ...x, qty: e.target.value.trim() } : x)))}
                        className="h-9 w-20 rounded-md border bg-background px-2 text-right"
                      />
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums">{now + (Number(r.qty) || 0)}</td>
                    <td className="p-3 text-right">
                      <button type="button" aria-label={`Hapus ${r.name}`} disabled={simpan} onClick={() => setRows((rs) => rs.filter((x) => x !== r))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={simpan || salah} className="h-10 rounded-md bg-primary px-5 font-medium text-primary-foreground disabled:opacity-40">
            {simpan ? "Menyimpan…" : `Simpan restok ${nama} (${rows.length} barang)`}
          </button>
          {salah && <span className="text-12 text-destructive">Jumlah masuk harus 1–9999.</span>}
        </div>
      )}
    </div>
  );
}
