"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { productSetActive } from "@/server/actions/channel-ops";
import { PRODUK_KE_MARKETPLACE } from "@/lib/flags";

const btn = "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-14 font-medium hover:bg-muted disabled:opacity-50";

/** Produk Tokopedia: aktif/nonaktifkan. Stok per gudang ada di StokGudang. */
export function ProductOps({ productId, active, variants }: { productId: string; active: boolean; variants: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle() {
    if (!confirm(active ? "Nonaktifkan produk ini? Pembeli tidak bisa membelinya sampai diaktifkan lagi." : "Aktifkan produk ini?")) return;
    start(async () => {
      const r = await productSetActive(productId, !active);
      setMsg(r.ok ? { ok: true, text: active ? "Produk dinonaktifkan." : "Produk diaktifkan." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRODUK_KE_MARKETPLACE && (
          <button type="button" onClick={toggle} disabled={pending} className={`${btn} ${active ? "text-destructive" : "text-emerald-600"}`}>
            <Power className="size-4" /> {active ? "Nonaktifkan" : "Aktifkan"}
          </button>
        )}
      </div>
      {msg && <p className={`text-14 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
