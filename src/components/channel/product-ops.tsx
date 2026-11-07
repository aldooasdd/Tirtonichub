"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, Warehouse } from "lucide-react";
import { productSetActive, productStock } from "@/server/actions/channel-ops";
import type { SkuStock } from "@/server/marketplace/tiktok-ops";

type Stock = (Omit<SkuStock, "warehouses"> & { warehouses: { id: string; name: string; available: number; committed: number }[] })[];
const btn = "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-14 font-medium hover:bg-muted disabled:opacity-50";

/** Produk Tokopedia: aktif/nonaktifkan + cek stok per gudang (Inventory Search). */
export function ProductOps({ productId, active, variants }: { productId: string; active: boolean; variants: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);

  function toggle() {
    if (!confirm(active ? "Nonaktifkan produk ini? Pembeli tidak bisa membelinya sampai diaktifkan lagi." : "Aktifkan produk ini?")) return;
    start(async () => {
      const r = await productSetActive(productId, !active);
      setMsg(r.ok ? { ok: true, text: active ? "Produk dinonaktifkan." : "Produk diaktifkan." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });
  }

  function loadStock() {
    start(async () => {
      const r = await productStock(productId);
      if (r.ok) setStock((r.data ?? []) as Stock);
      else setMsg({ ok: false, text: r.message });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={toggle} disabled={pending} className={`${btn} ${active ? "text-destructive" : "text-emerald-600"}`}>
          <Power className="size-4" /> {active ? "Nonaktifkan" : "Aktifkan"}
        </button>
        <button type="button" onClick={loadStock} disabled={pending} className={btn}>
          <Warehouse className="size-4" /> {pending && !stock ? "Memuat…" : "Stok per gudang"}
        </button>
      </div>
      {msg && <p className={`text-14 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
      {stock && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Varian</th>
                <th className="p-2">Gudang</th>
                <th className="p-2 text-right">Tersedia</th>
                <th className="p-2 text-right">Dipesan</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-muted-foreground">
                    Tidak ada data stok.
                  </td>
                </tr>
              )}
              {stock.flatMap((s) =>
                (s.warehouses.length ? s.warehouses : [{ id: "", name: "-", available: s.available, committed: s.committed }]).map((w, i) => (
                  <tr key={`${s.skuId}-${w.id}`} className="border-b last:border-b-0">
                    <td className="p-2">{i === 0 ? (variants[s.skuId] ?? s.sellerSku ?? s.skuId) : ""}</td>
                    <td className="p-2 text-muted-foreground">{w.name}</td>
                    <td className="p-2 text-right tabular-nums">{w.available}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{w.committed}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
