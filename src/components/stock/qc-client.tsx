"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { qcDecision } from "@/server/actions/raw-products";

type Item = {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  supplier: string | null;
  notaDate: string | null;
  byName: string;
};

const rupiah = new Intl.NumberFormat("id-ID");

export function QcClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  function act(id: string, decision: "STOCK" | "REJECTED") {
    const note = notes[id] ?? "";
    if (decision === "REJECTED" && !note.trim()) {
      alert("Penolakan wajib ada catatan.");
      return;
    }
    start(async () => {
      const r = await qcDecision(id, decision, note);
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
            <p className="text-14 text-muted-foreground">
              {i.qty} {i.unit ?? "pcs"} · Rp {rupiah.format(i.unitPrice)}
              {i.supplier ? ` · ${i.supplier}` : ""}
            </p>
            <p className="text-12 text-muted-foreground">
              Dari: {i.byName}
              {i.notaDate ? ` · nota ${i.notaDate}` : ""}
            </p>
            <Input
              className="mt-3"
              placeholder="Catatan (wajib bila tolak)"
              value={notes[i.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [i.id]: e.target.value }))}
            />
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={pending} onClick={() => act(i.id, "STOCK")}>
                Loloskan ke Stok
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => act(i.id, "REJECTED")}
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
