"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, MapPin, Printer, Receipt, Truck, PackageCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { orderDelivery, orderDocument, orderInvoice, orderPackage, orderProviders, orderShip, orderTracking } from "@/server/actions/channel-ops";
import { FAIL_REASONS } from "@/lib/channel-status";
import type { PackageInfo, TrackEvent } from "@/server/marketplace/tiktok-ops";

type Mode = "lacak" | "kirim" | "antar" | "faktur";
export type OrderActionInput = { id: string; status: string; shippingType: string | null; packageId: string | null; trackingNo: string | null };

const fmt = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(d)) : "-";
const PKG_STATUS: Record<string, string> = {
  TO_FULFILL: "Perlu dikirim",
  PROCESSING: "Diatur, menunggu kurir",
  FULFILLING: "Dalam pengiriman",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-12 font-medium hover:bg-muted disabled:opacity-50";
const field = "h-9 w-full rounded-md border bg-background px-2 text-14";

/** Tombol aksi pesanan Tokopedia: cetak label, lacak & detail paket, kirim/ubah resi, status antar, faktur. */
export function OrderActions({ o }: { o: OrderActionInput }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [track, setTrack] = useState<TrackEvent[] | null>(null);
  const [providers, setProviders] = useState<{ id: string; name: string }[] | null>(null);
  const [failed, setFailed] = useState(false);

  const self = o.shippingType === "SELLER";
  const canShip = self && o.status === "AWAITING_SHIPMENT";
  const canEditResi = self && ["AWAITING_COLLECTION", "IN_TRANSIT"].includes(o.status);
  const canDeliver = self && !!o.packageId && ["IN_TRANSIT", "DELIVERED"].includes(o.status);
  const canLabel = !self && !!o.packageId && !["UNPAID", "ON_HOLD", "CANCELLED"].includes(o.status);
  const canTrack = !!o.packageId || !!o.trackingNo;

  function open(m: Mode) {
    setErr("");
    setMode(m);
    if (m === "lacak") {
      setPkg(null);
      setTrack(null);
      start(async () => {
        const [p, t] = await Promise.all([o.packageId ? orderPackage(o.id) : null, orderTracking(o.id)]);
        if (p?.ok) setPkg(p.data ?? null);
        if (t.ok) setTrack(t.data ?? []);
        const e = [p && !p.ok ? p.message : "", !t.ok ? t.message : ""].filter(Boolean).join(" · ");
        if (e) setErr(e);
      });
    }
    if (m === "kirim" && !providers)
      start(async () => {
        const r = await orderProviders(o.id);
        if (r.ok) setProviders(r.data ?? []);
        else setErr(r.message);
      });
  }

  function print(type: "SHIPPING_LABEL" | "PACKING_SLIP" | "SHIPPING_LABEL_AND_PACKING_SLIP") {
    // Buka tab dulu (sinkron dengan klik) supaya tak diblokir popup blocker.
    const w = window.open("about:blank", "_blank");
    start(async () => {
      const r = await orderDocument(o.id, type);
      if (r.ok && r.data) {
        if (w) w.location.href = r.data;
        else window.location.href = r.data;
        router.refresh();
      } else {
        w?.close();
        alert(r.ok ? "Gagal mengambil dokumen." : r.message);
      }
    });
  }

  function submit(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setErr("");
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      if (!r.ok) return setErr(r.message ?? "Gagal.");
      setMode(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
        {canLabel && (
          <>
            <button type="button" className={btn} disabled={pending} onClick={() => print("SHIPPING_LABEL")}>
              <Printer className="size-3.5" /> Cetak label
            </button>
            <button type="button" className={btn} disabled={pending} onClick={() => print("PACKING_SLIP")}>
              <FileText className="size-3.5" /> Packing slip
            </button>
          </>
        )}
        {(canShip || canEditResi) && (
          <button type="button" className={btn} onClick={() => open("kirim")}>
            <Truck className="size-3.5" /> {canShip ? "Kirim pesanan" : "Ubah resi"}
          </button>
        )}
        {canDeliver && (
          <button type="button" className={btn} onClick={() => open("antar")}>
            <PackageCheck className="size-3.5" /> Status antar
          </button>
        )}
        {canTrack && (
          <button type="button" className={btn} onClick={() => open("lacak")}>
            <MapPin className="size-3.5" /> Lacak & detail paket
          </button>
        )}
        {o.packageId && (
          <button type="button" className={btn} onClick={() => open("faktur")}>
            <Receipt className="size-3.5" /> Upload faktur
          </button>
        )}
      </div>

      <Dialog open={!!mode} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "lacak" ? "Lacak & detail paket" : mode === "kirim" ? (canShip ? "Kirim pesanan" : "Ubah resi") : mode === "antar" ? "Status antar" : "Upload faktur"}
            </DialogTitle>
          </DialogHeader>

          {mode === "lacak" && (
            <div className="space-y-4 text-14">
              {pending && <p className="text-muted-foreground">Memuat…</p>}
              {pkg && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3">
                  {(
                    [
                      ["Status paket", pkg.status ? (PKG_STATUS[pkg.status] ?? pkg.status) : null],
                      ["Kurir", pkg.provider],
                      ["Resi", pkg.trackingNo],
                      ["Layanan", pkg.deliveryOption],
                      ["Serah ke kurir", pkg.handover === "PICKUP" ? "Dijemput kurir" : pkg.handover === "DROP_OFF" ? "Antar ke agen" : pkg.handover],
                      ["Jadwal jemput", pkg.pickupStart ? `${fmt(pkg.pickupStart)} – ${fmt(pkg.pickupEnd)}` : null],
                      ["Berat", pkg.weight],
                      ["Dimensi", pkg.dimension],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-12 text-muted-foreground">{k}</dt>
                      <dd className={k === "Resi" ? "font-mono text-12" : ""}>{v || "-"}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {track && (
                <div>
                  <h3 className="mb-2 font-semibold">Riwayat pengiriman</h3>
                  {track.length === 0 ? (
                    <p className="text-muted-foreground">Belum ada riwayat dari kurir.</p>
                  ) : (
                    <ol className="space-y-3 border-l pl-4">
                      {track.map((t, i) => (
                        <li key={i} className="relative">
                          <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden />
                          <p className={i === 0 ? "font-medium" : ""}>{t.text || "-"}</p>
                          <p className="text-12 text-muted-foreground">
                            {fmt(t.at)}
                            {t.carrier ? ` · ${t.carrier}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "kirim" && (
            <form
              className="space-y-3 text-14"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const pid = String(f.get("provider") ?? "");
                const name = providers?.find((p) => p.id === pid)?.name ?? "";
                submit(() => orderShip(o.id, String(f.get("resi") ?? ""), pid, name));
              }}
            >
              <p className="text-muted-foreground">Untuk pesanan kirim sendiri. Resi dan kurir dikirim ke Tokopedia.</p>
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Kurir</span>
                <select name="provider" required className={field} disabled={!providers}>
                  <option value="">{providers ? "Pilih kurir" : "Memuat kurir…"}</option>
                  {providers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Nomor resi</span>
                <input name="resi" required minLength={4} maxLength={50} pattern="[A-Za-z0-9_\-]+" defaultValue={o.trackingNo ?? ""} className={`${field} font-mono`} />
              </label>
              <button type="submit" disabled={pending || !providers} className="h-9 w-full rounded-md bg-primary text-14 font-medium text-primary-foreground disabled:opacity-50">
                {pending ? "Menyimpan…" : canShip ? "Tandai dikirim" : "Simpan resi"}
              </button>
            </form>
          )}

          {mode === "antar" && (
            <form className="space-y-3 text-14" onSubmit={(e) => (e.preventDefault(), submit(() => orderDelivery(o.id, new FormData(e.currentTarget))))}>
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Status</span>
                <select name="type" className={field} onChange={(e) => setFailed(e.target.value === "DELIVERY_FAILED")} defaultValue="DELIVERY_SUCCESS">
                  <option value="DELIVERY_SUCCESS">Berhasil diantar</option>
                  <option value="DELIVERY_FAILED">Gagal diantar</option>
                  <option value="UPDATE_POD">Ganti bukti antar</option>
                </select>
              </label>
              {failed && (
                <label className="block space-y-1">
                  <span className="text-12 text-muted-foreground">Alasan gagal</span>
                  <select name="reason" required className={field}>
                    <option value="">Pilih alasan</option>
                    {Object.entries(FAIL_REASONS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Bukti antar (foto JPG/PNG ≤5MB atau PDF ≤10MB)</span>
                <input name="file" type="file" accept="image/jpeg,image/png,application/pdf" className="block w-full text-14" />
              </label>
              <button type="submit" disabled={pending} className="h-9 w-full rounded-md bg-primary text-14 font-medium text-primary-foreground disabled:opacity-50">
                {pending ? "Mengirim…" : "Simpan status"}
              </button>
            </form>
          )}

          {mode === "faktur" && (
            <form className="space-y-3 text-14" onSubmit={(e) => (e.preventDefault(), submit(() => orderInvoice(o.id, new FormData(e.currentTarget))))}>
              <p className="text-muted-foreground">File faktur format XML, maksimal 1MB. Dikirim ke paket pesanan ini.</p>
              <input name="file" type="file" accept=".xml,text/xml,application/xml" required className="block w-full text-14" />
              <button type="submit" disabled={pending} className="h-9 w-full rounded-md bg-primary text-14 font-medium text-primary-foreground disabled:opacity-50">
                {pending ? "Mengunggah…" : "Upload faktur"}
              </button>
            </form>
          )}

          {err && <p className="rounded-md bg-destructive/10 p-2 text-14 text-destructive">{err}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
