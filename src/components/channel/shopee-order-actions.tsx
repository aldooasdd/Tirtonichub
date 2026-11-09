"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, MapPin, NotebookPen, Printer, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shopeeBuyerCancel, shopeeCancel, shopeeNote, shopeeOrderInfo, shopeeShip, shopeeShipMany, shopeeShipParam, shopeeTrack } from "@/server/actions/shopee-orders";
import type { ShipChoice, ShipParam } from "@/server/marketplace/shopee-logistics";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-12 font-medium hover:bg-muted disabled:opacity-50";
const field = "h-9 w-full rounded-md border bg-background px-2 text-14";
const primary = "h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-40";
const fmt = (t: number) => (t ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(t * 1000)) : "-");
const CANCEL = { OUT_OF_STOCK: "Stok habis", CUSTOMER_REQUEST: "Permintaan pembeli", UNDELIVERABLE_AREA: "Area tidak terjangkau" } as const;
type Mode = "kirim" | "lacak" | "batal" | "catatan";

/** Form pilih cara kirim (jemput / antar ke drop-off / kurir non-integrasi). */
function ShipForm({ p, busy, onSubmit }: { p: ShipParam; busy: boolean; onSubmit: (c: ShipChoice) => void }) {
  const modes = [p.needed.pickup.length || p.addresses.length ? "pickup" : null, p.needed.dropoff.length || p.branches.length ? "dropoff" : null].filter(Boolean) as ("pickup" | "dropoff")[];
  const [mode, setMode] = useState<"pickup" | "dropoff" | "non_integrated">(modes[0] ?? "non_integrated");
  const def = p.addresses.find((a) => a.flags.includes("pickup_address") || a.flags.includes("default_address")) ?? p.addresses[0];
  const [addr, setAddr] = useState(def?.id ?? "");
  const slots = p.addresses.find((a) => a.id === addr)?.slots ?? [];
  const [slot, setSlot] = useState((slots.find((s) => s.recommended) ?? slots[0])?.id ?? "");
  const [branch, setBranch] = useState(p.branches[0]?.id ?? "");
  const [sender, setSender] = useState("");
  const [tracking, setTracking] = useState("");
  const needTrack = (mode === "pickup" ? p.needed.pickup : mode === "dropoff" ? p.needed.dropoff : p.needed.nonIntegrated).includes("tracking_no");
  return (
    <div className="space-y-3">
      {modes.length > 1 && (
        <div className="flex gap-2">
          {modes.map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`${btn} ${mode === m ? "border-primary text-primary" : ""}`}>
              {m === "pickup" ? "Dijemput kurir" : "Antar ke drop-off"}
            </button>
          ))}
        </div>
      )}
      {mode === "pickup" && (
        <>
          <label className="block space-y-1 text-12 text-muted-foreground">
            Alamat jemput
            <select value={addr} onChange={(e) => { setAddr(e.target.value); setSlot(p.addresses.find((a) => a.id === e.target.value)?.slots[0]?.id ?? ""); }} className={field}>
              {p.addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.text}</option>
              ))}
            </select>
          </label>
          {slots.length > 0 && (
            <label className="block space-y-1 text-12 text-muted-foreground">
              Waktu jemput
              <select value={slot} onChange={(e) => setSlot(e.target.value)} className={field}>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>{s.text || fmt(s.date)}{s.recommended ? " (disarankan)" : ""}</option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {mode === "dropoff" && (
        <>
          {p.branches.length > 0 && (
            <label className="block space-y-1 text-12 text-muted-foreground">
              Cabang drop-off
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className={field}>
                {p.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.text}</option>
                ))}
              </select>
            </label>
          )}
          {p.needed.dropoff.includes("sender_real_name") && (
            <label className="block space-y-1 text-12 text-muted-foreground">
              Nama pengirim
              <input value={sender} onChange={(e) => setSender(e.target.value)} className={field} />
            </label>
          )}
        </>
      )}
      {(needTrack || mode === "non_integrated") && (
        <label className="block space-y-1 text-12 text-muted-foreground">
          No. resi{needTrack ? "" : " (opsional)"}
          <input value={tracking} onChange={(e) => setTracking(e.target.value.trim())} className={field} />
        </label>
      )}
      <button
        type="button"
        className={primary}
        disabled={busy || (mode === "pickup" && !addr) || (needTrack && !tracking) || (mode === "dropoff" && p.needed.dropoff.includes("sender_real_name") && !sender)}
        onClick={() =>
          onSubmit(
            mode === "pickup"
              ? { mode, addressId: addr, timeId: slot || undefined, tracking: tracking || undefined }
              : mode === "dropoff"
                ? { mode, branchId: p.needed.dropoff.includes("branch_id") ? branch : undefined, sender: sender || undefined, tracking: tracking || undefined }
                : { mode, tracking: tracking || undefined },
          )
        }
      >
        Atur pengiriman
      </button>
    </div>
  );
}

/** Aksi pesanan Shopee: atur kirim, label, lacak, batal, tanggapi pembatalan, catatan. */
export function ShopeeOrderActions({ sn, status, trackingNo }: { sn: string; status: string; trackingNo: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [param, setParam] = useState<ShipParam | null>(null);
  const [track, setTrack] = useState<{ status: string; tracking: string; events: { time: number; text: string }[] } | null>(null);
  const [info, setInfo] = useState<{ note: string; items: { itemId: string; modelId: string; name: string; qty: number }[] } | null>(null);
  const [reason, setReason] = useState<keyof typeof CANCEL>("OUT_OF_STOCK");
  const [pick, setPick] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const open = (m: Mode) => {
    setMode(m);
    setErr("");
    setOk("");
    start(async () => {
      if (m === "kirim") {
        const r = await shopeeShipParam(sn);
        if (!r.ok) setErr(r.message ?? "Gagal.");
        else setParam(r.data ?? null);
      } else if (m === "lacak") {
        const r = await shopeeTrack(sn);
        if (!r.ok) setErr(r.message ?? "Gagal.");
        else setTrack(r.data ?? null);
      } else {
        const r = await shopeeOrderInfo(sn);
        if (!r.ok) setErr(r.message ?? "Gagal.");
        else {
          setInfo(r.data ?? null);
          setNote(r.data?.note ?? "");
        }
      }
    });
  };
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, q?: string) => {
    if (q && !confirm(q)) return;
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      if (!r.ok) return setErr(r.message ?? "Gagal.");
      setOk(r.message ?? "Berhasil.");
      router.refresh();
    });
  };

  const canShip = status === "READY_TO_SHIP";
  const canLabel = ["READY_TO_SHIP", "PROCESSED", "SHIPPED", "RETRY_SHIP"].includes(status);
  const canCancel = ["UNPAID", "READY_TO_SHIP"].includes(status);
  const inCancel = status === "IN_CANCEL";

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {canShip && (
        <button className={btn} onClick={() => open("kirim")}>
          <Truck className="size-3.5" /> Atur kirim
        </button>
      )}
      {canLabel && (
        <a className={btn} href={`/api/channel/shopee-label?sn=${sn}`} target="_blank" rel="noreferrer">
          <Printer className="size-3.5" /> Label
        </a>
      )}
      <button className={btn} onClick={() => open("lacak")}>
        <MapPin className="size-3.5" /> Lacak
      </button>
      <button className={btn} onClick={() => open("catatan")}>
        <NotebookPen className="size-3.5" /> Catatan
      </button>
      {canCancel && (
        <button className={`${btn} text-destructive`} onClick={() => open("batal")}>
          <Ban className="size-3.5" /> Batalkan
        </button>
      )}
      {inCancel && (
        <>
          <button className={btn} disabled={pending} onClick={() => act(() => shopeeBuyerCancel(sn, true), "Terima permintaan batal dari pembeli?")}>
            Terima pembatalan
          </button>
          <button className={`${btn} text-destructive`} disabled={pending} onClick={() => act(() => shopeeBuyerCancel(sn, false), "Tolak permintaan batal dari pembeli?")}>
            Tolak pembatalan
          </button>
        </>
      )}
      {!mode && (err || ok) && <p className={`w-full text-12 ${err ? "text-destructive" : "text-emerald-600"}`}>{err || ok}</p>}

      <Dialog open={!!mode} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "kirim" ? "Atur pengiriman" : mode === "lacak" ? "Lacak paket" : mode === "batal" ? "Batalkan pesanan" : "Catatan penjual"} · {sn}
            </DialogTitle>
          </DialogHeader>
          {pending && !param && !track && !info && <p className="text-14 text-muted-foreground">Memuat…</p>}
          {mode === "kirim" && param && <ShipForm p={param} busy={pending} onSubmit={(c) => act(() => shopeeShip(sn, c))} />}
          {mode === "lacak" && track && (
            <div className="space-y-2 text-14">
              <p>
                Resi: <span className="font-mono">{track.tracking || trackingNo || "-"}</span> · {track.status || "-"}
              </p>
              <ol className="max-h-80 space-y-1 overflow-y-auto">
                {track.events.map((e, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{fmt(e.time)}</span> · {e.text}
                  </li>
                ))}
                {!track.events.length && <li className="text-muted-foreground">Belum ada riwayat.</li>}
              </ol>
            </div>
          )}
          {mode === "batal" && info && (
            <div className="space-y-3">
              <select value={reason} onChange={(e) => setReason(e.target.value as keyof typeof CANCEL)} className={field}>
                {Object.entries(CANCEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              {reason === "OUT_OF_STOCK" && (
                <div className="space-y-1 text-14">
                  <p className="text-12 text-muted-foreground">Produk yang stoknya habis:</p>
                  {info.items.map((i) => {
                    const k = `${i.itemId}:${i.modelId}`;
                    return (
                      <label key={k} className="flex items-center gap-2">
                        <input type="checkbox" checked={pick.includes(k)} onChange={(e) => setPick(e.target.checked ? [...pick, k] : pick.filter((x) => x !== k))} />
                        {i.name} ×{i.qty}
                      </label>
                    );
                  })}
                </div>
              )}
              <button
                className={`${primary} bg-destructive`}
                disabled={pending || (reason === "OUT_OF_STOCK" && !pick.length)}
                onClick={() =>
                  act(
                    () => shopeeCancel(sn, reason, pick.map((k) => ({ itemId: k.split(":")[0], modelId: k.split(":")[1] }))),
                    "Batalkan pesanan ini di Shopee? Tidak bisa dibatalkan kembali.",
                  )
                }
              >
                Batalkan pesanan
              </button>
            </div>
          )}
          {mode === "catatan" && info && (
            <div className="space-y-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={500} className="w-full rounded-md border bg-background p-2 text-14" />
              <button className={primary} disabled={pending || note === info.note} onClick={() => act(() => shopeeNote(sn, note))}>
                Simpan catatan
              </button>
            </div>
          )}
          {(err || ok) && <p className={`text-14 ${err ? "text-destructive" : "text-emerald-600"}`}>{err || ok}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Atur kirim & cetak label banyak pesanan Shopee "Perlu dikirim" sekaligus. */
export function ShopeeMassShip({ sns }: { sns: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [param, setParam] = useState<ShipParam | null>(null);
  const [msg, setMsg] = useState("");
  const [fails, setFails] = useState<string[]>([]);
  if (!sns.length) return null;
  const show = () => {
    setOpen(true);
    setMsg("");
    setFails([]);
    start(async () => {
      const r = await shopeeShipParam(sns[0]);
      if (!r.ok) setMsg(r.message ?? "Gagal.");
      else setParam(r.data ?? null);
    });
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={show}>
          <Truck className="size-3.5" /> Atur kirim {sns.length} pesanan Shopee
        </button>
        <a className={btn} href={`/api/channel/shopee-label?sn=${sns.slice(0, 50).join(",")}`} target="_blank" rel="noreferrer">
          <Printer className="size-3.5" /> Label {Math.min(50, sns.length)} pesanan
        </a>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur kirim {sns.length} pesanan Shopee</DialogTitle>
          </DialogHeader>
          <p className="text-12 text-muted-foreground">Pilihan diambil dari pesanan pertama dan dipakai untuk semua. Pesanan dengan kurir berbeda bisa gagal; ulangi satu per satu.</p>
          {pending && !param && <p className="text-14 text-muted-foreground">Memuat…</p>}
          {param && (
            <ShipForm
              p={param}
              busy={pending}
              onSubmit={(c) =>
                confirm(`Atur pengiriman ${sns.length} pesanan?`) &&
                start(async () => {
                  const r = await shopeeShipMany(sns, c);
                  setMsg(r.ok ? `${sns.length - (r.data?.length ?? 0)} berhasil, ${r.data?.length ?? 0} gagal.` : (r.message ?? "Gagal."));
                  setFails(r.data ?? []);
                  router.refresh();
                })
              }
            />
          )}
          {msg && <p className="text-14">{msg}</p>}
          {fails.length > 0 && (
            <ul className="max-h-40 overflow-y-auto text-12 text-destructive">
              {fails.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
