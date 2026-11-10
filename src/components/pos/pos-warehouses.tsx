"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBranchWarehouses } from "@/server/actions/pos";
import type { Warehouse } from "@/server/pos-warehouses";

/** Pilih gudang marketplace milik cabang → stok cabang di kasir. */
export function PosWarehouses({ branchId, selected, warehouses }: { branchId: string; selected: string[]; warehouses: Warehouse[] }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(selected));
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = selected.length ? warehouses.filter((w) => selected.includes(w.key)).map((w) => `${w.name} (${w.platform})`).join(", ") || `${selected.length} gudang` : "Belum dipilih";

  if (!open)
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <span className={`max-w-56 truncate ${selected.length ? "" : "text-muted-foreground"}`} title={label}>{label}</span>
        <button onClick={() => setOpen(true)} className="text-primary underline">Atur</button>
      </span>
    );

  return (
    <span className="inline-flex flex-col items-end gap-1.5 text-left">
      {warehouses.length === 0 && <span className="text-12 text-muted-foreground">Belum ada data gudang — tunggu sinkron produk berikutnya (tiap jam).</span>}
      {warehouses.map((w) => (
        <label key={w.key} className="flex items-center gap-2 text-14">
          <input
            type="checkbox"
            checked={sel.has(w.key)}
            onChange={(e) => {
              const n = new Set(sel);
              if (e.target.checked) n.add(w.key);
              else n.delete(w.key);
              setSel(n);
            }}
          />
          {w.name} <span className="text-12 text-muted-foreground">{w.platform}</span>
        </label>
      ))}
      <span className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => start(async () => { await setBranchWarehouses(branchId, [...sel]); setOpen(false); router.refresh(); })}
          className="h-8 rounded-sm bg-primary px-3 text-14 font-semibold text-primary-foreground disabled:opacity-50"
        >
          Simpan
        </button>
        <button onClick={() => { setSel(new Set(selected)); setOpen(false); }} className="h-8 px-2 text-14 text-muted-foreground">Batal</button>
      </span>
    </span>
  );
}
