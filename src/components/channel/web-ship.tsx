"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { shipWebsiteOrder } from "@/server/actions/channel";

/** Pesanan Tirtonic.com: isi / ubah resi → status Dikirim di web (WA resi ke pembeli dari tirtonic.com). */
export function WebShip({ id, status, resi, kurir }: { id: string; status: string; resi: string | null; kurir: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  if (!["AWAITING_SHIPMENT", "IN_TRANSIT"].includes(status) || kurir === "Ambil di toko") return null;

  return (
    <div className="border-t px-4 py-2.5">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-12 font-medium hover:bg-muted">
          <Truck className="size-3.5" /> {status === "AWAITING_SHIPMENT" ? "Input resi" : "Ubah resi"}
        </button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setErr("");
            start(async () => {
              const r = await shipWebsiteOrder(id, String(f.get("resi") ?? ""), String(f.get("kurir") ?? ""));
              if (!r.ok) return setErr(r.message ?? "Gagal.");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Kurir
            <input name="kurir" defaultValue={kurir ?? ""} className="h-8 w-48 rounded-md border bg-background px-2 text-14" />
          </label>
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Nomor resi
            <input name="resi" required minLength={4} maxLength={50} defaultValue={resi ?? ""} className="h-8 w-48 rounded-md border bg-background px-2 font-mono text-14" />
          </label>
          <button type="submit" disabled={pending} className="h-8 rounded-md bg-primary px-3 text-12 font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Menyimpan…" : "Simpan & kirim WA"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="h-8 px-2 text-12 text-muted-foreground">
            Batal
          </button>
          {err && <p className="w-full text-12 text-destructive">{err}</p>}
        </form>
      )}
    </div>
  );
}
