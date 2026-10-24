"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { qcDecision } from "@/server/actions/raw-products";

type Item = {
  id: string;
  name: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  qty: number;
  unit: string | null;
  sellPrice: number | null;
  supplier: string | null;
  notaDate: string | null;
  byName: string;
};

type FieldKey = "name" | "color" | "size" | "sku" | "qty" | "unit" | "sellPrice" | "supplier";

function defVal(i: Item, key: FieldKey): string {
  switch (key) {
    case "name": return i.name;
    case "color": return i.color ?? "";
    case "size": return i.size ?? "";
    case "sku": return i.sku ?? "";
    case "qty": return String(i.qty);
    case "unit": return i.unit ?? "";
    case "sellPrice": return i.sellPrice != null ? String(i.sellPrice) : "";
    case "supplier": return i.supplier ?? "";
  }
}

export function QcClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Record<string, Partial<Record<FieldKey, string>>>>({});

  const val = (i: Item, key: FieldKey) => form[i.id]?.[key] ?? defVal(i, key);
  const setField = (id: string, key: FieldKey, v: string) =>
    setForm((n) => ({ ...n, [id]: { ...n[id], [key]: v } }));

  function act(i: Item, decision: "STOCK" | "REJECTED") {
    if (decision === "STOCK") {
      if (!val(i, "name").trim()) {
        alert("Nama wajib diisi.");
        return;
      }
      if (!val(i, "sku").trim()) {
        alert("Scan / isi SKU barcode dulu sebelum loloskan.");
        return;
      }
    }
    start(async () => {
      const r = await qcDecision(
        i.id,
        decision,
        decision === "STOCK"
          ? {
              name: val(i, "name"),
              color: val(i, "color"),
              size: val(i, "size"),
              sku: val(i, "sku"),
              qty: Number(val(i, "qty")) || undefined,
              unit: val(i, "unit"),
              sellPrice: Number(val(i, "sellPrice")) || undefined,
              supplier: val(i, "supplier"),
            }
          : undefined,
      );
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Quality Control</h1>
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Tidak ada item menunggu QC.
          </p>
        )}
        {items.map((i) => (
          <div key={i.id} className="space-y-2 rounded-lg border bg-card p-4">
            {i.brand && <p className="text-12 text-muted-foreground">Merek: {i.brand}</p>}
            <p className="text-12 text-muted-foreground">
              Dari: {i.byName}
              {i.notaDate ? ` · nota ${i.notaDate}` : ""}
            </p>
            <label className="block space-y-1">
              <span className="block text-12 text-muted-foreground">Nama barang</span>
              <Input value={val(i, "name")} onChange={(e) => setField(i.id, "name", e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="block space-y-1">
                <span className="block text-12 text-muted-foreground">Warna</span>
                <Input value={val(i, "color")} onChange={(e) => setField(i.id, "color", e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="block text-12 text-muted-foreground">Ukuran</span>
                <Input value={val(i, "size")} onChange={(e) => setField(i.id, "size", e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="block text-12 text-muted-foreground">Satuan</span>
                <Input value={val(i, "unit")} onChange={(e) => setField(i.id, "unit", e.target.value)} placeholder="pcs" />
              </label>
              <label className="block space-y-1">
                <span className="block text-12 text-muted-foreground">Harga jual</span>
                <Input type="number" value={val(i, "sellPrice")} onChange={(e) => setField(i.id, "sellPrice", e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="block text-12 text-muted-foreground">Supplier</span>
              <Input value={val(i, "supplier")} onChange={(e) => setField(i.id, "supplier", e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="block text-12 text-muted-foreground">SKU barcode (scan produk)</span>
              <Input
                placeholder="Scan / ketik SKU"
                value={val(i, "sku")}
                onChange={(e) => setField(i.id, "sku", e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="block text-12 text-muted-foreground">Total lolos QC ({i.unit ?? "pcs"})</span>
              <Input
                type="number"
                value={val(i, "qty")}
                onChange={(e) => setField(i.id, "qty", e.target.value)}
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" disabled={pending} onClick={() => act(i, "STOCK")}>
                Loloskan ke Stok
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => act(i, "REJECTED")}
              >
                Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
