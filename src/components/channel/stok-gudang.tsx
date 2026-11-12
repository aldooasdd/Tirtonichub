"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Warehouse } from "lucide-react";
import { stokGudang, ubahStokGudang, type GudangRow } from "@/server/actions/stok-gudang";

const btn = "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-14 font-medium hover:bg-muted disabled:opacity-50";
const sm = "inline-flex size-8 items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40";

/** Stok per gudang Shopee / Tokopedia + tambah / kurangi per varian per gudang. */
export function StokGudang({ platform, productId, variants, editable }: { platform: "SHOPEE" | "TOKOPEDIA"; productId: string; variants: Record<string, string>; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<GudangRow[] | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const key = (r: GudangRow) => `${r.skuId}|${r.warehouseId}`;

  const load = () =>
    start(async () => {
      const r = await stokGudang(platform, productId);
      if (r.ok) setRows(r.data ?? []);
      else setMsg({ ok: false, text: r.message ?? "Gagal." });
    });
  // Langsung kirim per klik: jumlah = angka yang diketik, kosong = 1. Satu baris diproses satu-satu (anti balapan stok).
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const change = async (r: GudangRow, sign: 1 | -1) => {
    const k = key(r);
    const d = sign * (Number(qty[k]) || 1);
    if (busy.has(k) || r.stock + d < 0) return;
    setBusy((b) => new Set(b).add(k));
    setRows((rs) => rs && rs.map((x) => (key(x) === k ? { ...x, stock: x.stock + d } : x)));
    const res = await ubahStokGudang(platform, productId, r.skuId, r.warehouseId, d).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman.", data: undefined }));
    setMsg({ ok: res.ok, text: res.message ?? "" });
    if (res.data) setRows(res.data);
    else if (!res.ok) setRows((rs) => rs && rs.map((x) => (key(x) === k ? { ...x, stock: x.stock - d } : x)));
    setBusy((b) => {
      const n = new Set(b);
      n.delete(k);
      return n;
    });
    if (res.ok) router.refresh();
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={load} disabled={pending} className={btn}>
        <Warehouse className="size-4" /> {pending && !rows ? "Memuat…" : rows ? "Muat ulang stok per gudang" : "Stok per gudang"}
      </button>
      {msg && <p className={`text-14 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
      {rows && (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Varian</th>
                <th className="p-2">Gudang</th>
                <th className="p-2 text-right">Stok</th>
                <th className="p-2 text-right">Dipesan</th>
                {editable && <th className="p-2" title="Klik − / + langsung mengubah stok di marketplace. Kosong = 1.">Tambah / kurangi</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-muted-foreground">Tidak ada data stok.</td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={key(r)} className="border-b last:border-b-0">
                  <td className="p-2">{i === 0 || rows[i - 1].skuId !== r.skuId ? (variants[r.skuId] ?? (r.skuId || "-")) : ""}</td>
                  <td className="p-2 text-muted-foreground">{r.warehouse}</td>
                  <td className={`p-2 text-right tabular-nums ${r.stock === 0 ? "font-semibold text-destructive" : ""}`}>{r.stock}</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">{r.reserved}</td>
                  {editable && (
                    <td className="p-2">
                      <span className="flex items-center gap-1.5">
                        <button type="button" className={sm} disabled={busy.has(key(r)) || r.stock - (Number(qty[key(r)]) || 1) < 0} onClick={() => change(r, -1)} aria-label="Kurangi">
                          <Minus className="size-4" />
                        </button>
                        <input
                          inputMode="numeric"
                          value={qty[key(r)] ?? ""}
                          onChange={(e) => setQty({ ...qty, [key(r)]: e.target.value.replace(/\D/g, "") })}
                          placeholder="1"
                          aria-label={`Jumlah ${variants[r.skuId] ?? r.skuId} ${r.warehouse}`}
                          className="h-8 w-16 rounded-md border bg-background px-2 text-right text-14"
                        />
                        <button type="button" className={sm} disabled={busy.has(key(r))} onClick={() => change(r, 1)} aria-label="Tambah">
                          <Plus className="size-4" />
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
