"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { pushTokopediaToWeb } from "@/server/actions/produk-master";

/** Kirim semua produk Tokopedia ke tirtonic.com (bisa diklik ulang untuk update stok/detail). */
export function PushWebButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Export semua produk Tokopedia (detail, foto, varian, stok) ke tirtonic.com? Produk yang sudah ada di web dilewati.")) return;
          setMsg(null);
          start(async () => {
            const r = await pushTokopediaToWeb();
            setMsg({ ok: r.ok, text: r.message ?? "" });
            router.refresh();
          });
        }}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-14 font-medium text-sky-600 disabled:opacity-40"
      >
        <Globe className="size-4" /> {pending ? "Mengekspor…" : "Export ke Web"}
      </button>
      {msg && <p className={`max-w-xs text-right text-12 ${msg.ok ? "text-emerald-600" : "text-amber-700"}`}>{msg.text}</p>}
    </div>
  );
}
