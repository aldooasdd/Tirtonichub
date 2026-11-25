"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unpairTags } from "@/server/actions/rfid";

/** Kotak cari: isi lama terpilih, jadi scan stiker/barcode berikutnya langsung menimpa. */
export function TagSearch({ value }: { value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [value]);
  return <input ref={ref} name="q" key={value} defaultValue={value} placeholder="Scan stiker / barcode, atau ketik nama / SKU" aria-label="Cari tag" autoComplete="off" className="h-9 min-w-[220px] flex-1 rounded-md border bg-background px-3 text-14" />;
}

export function LepasTag({ epc, sku }: { epc: string; sku: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-12 text-destructive hover:underline disabled:opacity-40"
      onClick={() => {
        if (!confirm(`Lepas tag ${epc} dari SKU ${sku}?`)) return;
        start(async () => {
          try {
            await unpairTags([epc], sku);
            router.refresh();
          } catch {
            alert("Gagal melepas tag. Muat ulang halaman.");
          }
        });
      }}
    >
      {pending ? "Melepas…" : "Lepas"}
    </button>
  );
}
