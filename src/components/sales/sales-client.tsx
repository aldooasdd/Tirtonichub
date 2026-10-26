"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/image";
import { scanSalesNota, saveSalesReport } from "@/server/actions/sales";
import type { SalesItem, SalesPayment } from "@/server/n8n-sales";

export type SalesRow = {
  id: string;
  soldAt: string; // sudah diformat
  salesman: string | null;
  customer: string | null;
  grandTotal: number;
  itemCount: number;
  by: string;
};

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

type Draft = {
  notaNo: string;
  soldAt: string; // datetime-local
  customer: string;
  salesman: string;
  employee: string;
  items: SalesItem[];
  payments: SalesPayment[];
  subtotal: number;
  total: number;
  grandTotal: number;
};

const emptyDraft = (): Draft => ({
  notaNo: "", soldAt: "", customer: "", salesman: "", employee: "",
  items: [{ name: "", qty: 1, price: 0, total: 0, note: null }],
  payments: [{ method: "", amount: 0 }],
  subtotal: 0, total: 0, grandTotal: 0,
});

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="block text-12 text-muted-foreground">{label}</span>
    {children}
  </label>
);

export function SalesClient({ reports, canViewAll }: { reports: SalesRow[]; canViewAll: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function onCapture(file: File) {
    setBusy(true);
    setMsg("Memindai nota…");
    try {
      const b64 = await blobToBase64(await compressImage(file));
      const r = await scanSalesNota(b64, "image/jpeg");
      if (!r.ok || !r.photoKey) {
        setMsg(r.message ?? "Gagal pindai.");
        return;
      }
      setPhotoKey(r.photoKey);
      const p = r.parsed!;
      setDraft({
        notaNo: p.notaNo ?? "",
        soldAt: p.soldAt ? p.soldAt.slice(0, 16) : "",
        customer: p.customer ?? "",
        salesman: p.salesman ?? "",
        employee: p.employee ?? "",
        items: p.items.length ? p.items : emptyDraft().items,
        payments: p.payments.length ? p.payments : emptyDraft().payments,
        subtotal: p.subtotal,
        total: p.total,
        grandTotal: p.grandTotal,
      });
      setMsg(r.ocr ? "AI mengisi otomatis. Periksa lalu kirim." : "AI tak terbaca — isi manual.");
    } finally {
      setBusy(false);
    }
  }

  const upd = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setItem = (i: number, patch: Partial<SalesItem>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : d));
  const setPay = (i: number, patch: Partial<SalesPayment>) =>
    setDraft((d) => (d ? { ...d, payments: d.payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : d));

  function reset() {
    setDraft(null);
    setPhotoKey(null);
    setMsg("");
  }

  async function submit() {
    if (!draft || !photoKey) return;
    setBusy(true);
    const r = await saveSalesReport({
      photoKey,
      notaNo: draft.notaNo,
      soldAt: draft.soldAt || null,
      customer: draft.customer,
      salesman: draft.salesman,
      employee: draft.employee,
      items: draft.items,
      subtotal: draft.subtotal,
      total: draft.total,
      grandTotal: draft.grandTotal,
      payments: draft.payments,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message ?? "Gagal simpan.");
      return;
    }
    reset();
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Penjualan</h1>
          <p className="text-14 text-muted-foreground">Foto nota penjualan, AI isi datanya, lalu kirim ke Finance.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])}
        />
        {!draft && (
          <Button disabled={busy} onClick={() => fileRef.current?.click()} className="shrink-0">
            {busy ? "Memindai…" : "Foto nota penjualan"}
          </Button>
        )}
      </div>

      {!draft ? (
        msg ? <p className="text-12 text-muted-foreground">{msg}</p> : null
      ) : (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          {msg && <p className="text-12 text-muted-foreground">{msg}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="No. nota"><Input value={draft.notaNo} onChange={(e) => upd({ notaNo: e.target.value })} /></Field>
            <Field label="Waktu transaksi"><Input type="datetime-local" value={draft.soldAt} onChange={(e) => upd({ soldAt: e.target.value })} /></Field>
            <Field label="Pelanggan"><Input value={draft.customer} onChange={(e) => upd({ customer: e.target.value })} /></Field>
            <Field label="Salesman"><Input value={draft.salesman} onChange={(e) => upd({ salesman: e.target.value })} /></Field>
            <Field label="Karyawan"><Input value={draft.employee} onChange={(e) => upd({ employee: e.target.value })} /></Field>
          </div>

          <div className="space-y-2">
            <p className="text-12 font-medium text-muted-foreground">Item</p>
            {draft.items.map((it, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_70px_110px_110px_auto]">
                <Input placeholder="Nama item" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                <Input type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                <Input type="number" placeholder="Harga" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) })} />
                <Input type="number" placeholder="Total" value={it.total} onChange={(e) => setItem(i, { total: Number(e.target.value) })} />
                <Button variant="outline" size="sm" onClick={() => upd({ items: draft.items.filter((_, j) => j !== i) })}>Hapus</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => upd({ items: [...draft.items, { name: "", qty: 1, price: 0, total: 0, note: null }] })}>+ Item</Button>
          </div>

          <div className="space-y-2">
            <p className="text-12 font-medium text-muted-foreground">Pembayaran</p>
            {draft.payments.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <Input placeholder="Metode (mis. Transfer Mandiri)" value={p.method} onChange={(e) => setPay(i, { method: e.target.value })} />
                <Input type="number" placeholder="Jumlah" value={p.amount} onChange={(e) => setPay(i, { amount: Number(e.target.value) })} />
                <Button variant="outline" size="sm" onClick={() => upd({ payments: draft.payments.filter((_, j) => j !== i) })}>Hapus</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => upd({ payments: [...draft.payments, { method: "", amount: 0 }] })}>+ Pembayaran</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Subtotal"><Input type="number" value={draft.subtotal} onChange={(e) => upd({ subtotal: Number(e.target.value) })} /></Field>
            <Field label="Total"><Input type="number" value={draft.total} onChange={(e) => upd({ total: Number(e.target.value) })} /></Field>
            <Field label="Grand total"><Input type="number" value={draft.grandTotal} onChange={(e) => upd({ grandTotal: Number(e.target.value) })} /></Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={submit}>{busy ? "Menyimpan…" : "Kirim ke Finance"}</Button>
            <Button variant="outline" disabled={busy} onClick={reset}>Batal</Button>
          </div>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-14 font-medium text-muted-foreground">{canViewAll ? "Penjualan terbaru" : "Rekap saya"}</h2>
        {reports.length === 0 ? (
          <p className="rounded-lg border bg-card py-8 text-center text-muted-foreground">Belum ada.</p>
        ) : (
          <div className="rounded-lg border bg-card divide-y">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{rupiah(r.grandTotal)} <span className="text-12 font-normal text-muted-foreground">· {r.itemCount} item</span></p>
                  <p className="text-11 text-muted-foreground">{r.soldAt}{r.salesman ? ` · ${r.salesman}` : ""}{canViewAll ? ` · ${r.by}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
