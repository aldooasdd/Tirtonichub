"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { connectShop, demoOff, demoOn, disconnectShop, syncNow } from "@/server/actions/channel";

export type ShopCard = {
  platform: string;
  label: string;
  status: "none" | "demo" | "live";
  shopName: string | null;
  lastSync: string | null;
  apiReady: boolean;
};

/** Kartu koneksi toko + tombol sambung / sinkron / putus + mode contoh. */
export function ShopPanel({ shops, anyDemo }: { shops: ShopCard[]; anyDemo: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; url?: string }>, okText?: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman lalu coba lagi." }) as { ok: boolean; message?: string; url?: string });
      if (r.url) {
        window.location.href = r.url; // ke halaman izin Shopee / TikTok Shop
        return;
      }
      setMsg({ ok: r.ok, text: r.message ?? (r.ok ? okText ?? "Beres." : "Gagal.") });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {shops.map((s) => (
          <div key={s.platform} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{s.label}</h2>
                <p className="text-12 text-muted-foreground">
                  {s.status === "none" ? "Belum tersambung" : s.shopName ?? "-"}
                  {s.lastSync ? ` · sinkron ${s.lastSync}` : ""}
                </p>
              </div>
              <span
                className={
                  s.status === "live"
                    ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-12 font-medium text-emerald-600"
                    : s.status === "demo"
                      ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-12 font-medium text-amber-600"
                      : "rounded-full bg-muted px-2 py-0.5 text-12 text-muted-foreground"
                }
              >
                {s.status === "live" ? "Tersambung" : s.status === "demo" ? "Contoh" : "Off"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.status !== "live" && (
                <Button size="sm" disabled={pending} onClick={() => run(() => connectShop(s.platform))} title={s.apiReady ? "" : "Kunci API belum diisi di server"}>
                  Sambungkan
                </Button>
              )}
              {s.status !== "none" && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => syncNow(s.platform))}>
                  Sinkron sekarang
                </Button>
              )}
              {s.status === "live" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => confirm(`Putuskan ${s.label}? Data order tetap tersimpan.`) && run(() => disconnectShop(s.platform), `${s.label} diputus.`)}
                >
                  Putuskan
                </Button>
              )}
            </div>
            {!s.apiReady && s.status !== "live" && (
              <p className="text-12 text-muted-foreground">Kunci API {s.label} belum diisi di server. Pakai Mode Contoh untuk uji coba.</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
        <span className="text-14 text-muted-foreground">Mode Contoh: data toko palsu untuk uji coba fitur (tidak menyentuh toko asli).</span>
        {anyDemo ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(demoOff, "Data contoh dihapus.")}>
            Hapus data contoh
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(demoOn, "Toko contoh siap. Coba Sinkron, ubah stok, lihat Settlement Marketplace.")}>
            Mulai Mode Contoh
          </Button>
        )}
      </div>

      {msg && <p className={msg.ok ? "text-14 text-emerald-600" : "text-14 text-destructive"}>{msg.text}</p>}
    </div>
  );
}
