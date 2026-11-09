"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { pushProductToWeb } from "@/server/actions/produk-master";

/** Export 1 produk Tokopedia ke tirtonic.com (detail, foto, varian, stok). Kalau sudah ada di web → ditimpa. */
export function PushWebButton({ itemId, onWeb }: { itemId: string; onWeb: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          (!onWeb || confirm("Produk ini sudah ada di tirtonic.com. Timpa dengan data Tokopedia (nama, foto, deskripsi, varian, harga, stok)?")) &&
          start(async () => {
            const r = await pushProductToWeb(itemId).catch(() => ({ ok: false, message: "Gagal. Coba lagi." }));
            setMsg({ ok: r.ok, text: r.message ?? "" });
            if (r.ok) router.refresh();
          })
        }
        className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border px-2.5 text-12 font-medium text-sky-600 disabled:opacity-40"
      >
        <Globe className="size-3.5" /> {pending ? "Mengirim…" : onWeb ? "Export ulang" : "Export ke Web"}
      </button>
      {msg && <p className={`max-w-[160px] text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
