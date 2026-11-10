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
  const change = (r: GudangRow, sign: 1 | -1) => {
    const n = Number(qty[key(r)] || 0);
    if (!n) return;
    if (!confirm(`${sign < 0 ? "Kurangi" : "Tambah"} stok ${variants[r.skuId] ?? r.skuId} di ${r.warehouse} sebanyak ${n}? Langsung berubah di ${platform === "SHOPEE" ? "Shopee" : "Tokopedia"}.`)) return;
    start(async () => {
      const res = await ubahStokGudang(platform, productId, r.skuId, r.warehouseId, sign * n).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman.", data: undefined }));
      setMsg({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) {
        if (res.data) setRows(res.data);
        setQty((q) => ({ ...q, [key(r)]: "" }));
        router.refresh();
      }
    });
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
                {editable && <th className="p-2">Tambah / kurangi</th>}
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
                        <button type="button" className={sm} disabled={pending || !Number(qty[key(r)])} onClick={() => change(r, -1)} aria-label="Kurangi">
                          <Minus className="size-4" />
                        </button>
                        <input
                          inputMode="numeric"
                          value={qty[key(r)] ?? ""}
                          onChange={(e) => setQty({ ...qty, [key(r)]: e.target.value.replace(/\D/g, "") })}
                          placeholder="0"
                          aria-label={`Jumlah ${variants[r.skuId] ?? r.skuId} ${r.warehouse}`}
                          className="h-8 w-16 rounded-md border bg-background px-2 text-right text-14"
                        />
                        <button type="button" className={sm} disabled={pending || !Number(qty[key(r)])} onClick={() => change(r, 1)} aria-label="Tambah">
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
