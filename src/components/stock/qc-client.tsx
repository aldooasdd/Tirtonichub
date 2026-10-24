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

const rupiah = new Intl.NumberFormat("id-ID");

export function QcClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pass, setPass] = useState<Record<string, string>>({});
  const [sku, setSku] = useState<Record<string, string>>({});

  function act(i: Item, decision: "STOCK" | "REJECTED") {
    const skuVal = (sku[i.id] ?? i.sku ?? "").trim();
    if (decision === "STOCK" && !skuVal) {
      alert("Scan / isi SKU barcode dulu sebelum loloskan.");
      return;
    }
    start(async () => {
      const r = await qcDecision(
        i.id,
        decision,
        decision === "STOCK" ? Number(pass[i.id]) || undefined : undefined,
        decision === "STOCK" ? skuVal : undefined,
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
          <div key={i.id} className="rounded-lg border bg-card p-4">
            <p className="font-medium">{i.name}</p>
            {(i.brand || i.color || i.size || i.sku) && (
              <p className="text-12 text-muted-foreground">
                {[i.brand, i.color, i.size, i.sku ? `SKU ${i.sku}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-14 text-muted-foreground">
              {i.qty} {i.unit ?? "pcs"}
              {i.supplier ? ` · ${i.supplier}` : ""}
            </p>
            {i.sellPrice != null && (
              <p className="text-12 font-medium">Jual: Rp {rupiah.format(i.sellPrice)}</p>
            )}
            <p className="text-12 text-muted-foreground">
              Dari: {i.byName}
              {i.notaDate ? ` · nota ${i.notaDate}` : ""}
            </p>
            <label className="mt-3 block text-12 text-muted-foreground">
              SKU barcode (scan produk)
            </label>
            <Input
              className="mt-1"
              placeholder="Scan / ketik SKU"
              value={sku[i.id] ?? i.sku ?? ""}
              onChange={(e) => setSku((n) => ({ ...n, [i.id]: e.target.value }))}
            />
            <label className="mt-3 block text-12 text-muted-foreground">
              Total lolos QC ({i.unit ?? "pcs"})
            </label>
            <Input
              type="number"
              className="mt-1"
              placeholder={String(i.qty)}
              value={pass[i.id] ?? String(i.qty)}
              onChange={(e) => setPass((n) => ({ ...n, [i.id]: e.target.value }))}
            />
            <div className="mt-3 flex gap-2">
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
