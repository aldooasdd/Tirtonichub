"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { compressImage } from "@/lib/image";
import {
  scanNota,
  saveRawBatch,
  updateRawProduct,
  deleteRawProduct,
  submitBatchToQc,
} from "@/server/actions/raw-products";

type Item = {
  id: string;
  batchId: string;
  name: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  supplier: string | null;
  notaDate: string | null;
  status: "DRAFT" | "QC" | "STOCK" | "REJECTED";
  qcNote: string | null;
  qcByName: string | null;
};

const STATUS_LABEL: Record<Item["status"], string> = {
  DRAFT: "Draft",
  QC: "Quality Control",
  STOCK: "Stok",
  REJECTED: "Ditolak",
};
function statusVariant(s: Item["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (s === "STOCK") return "default";
  if (s === "REJECTED") return "destructive";
  if (s === "QC") return "secondary";
  return "outline";
}

const rupiah = new Intl.NumberFormat("id-ID");

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function FinanceClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPick(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await compressImage(file);
      const b64 = await blobToBase64(blob);
      const scan = await scanNota(b64, "image/jpeg");
      if (!scan.ok || !scan.batchId) {
        setMsg(scan.message ?? "Scan gagal.");
        return;
      }
      const parsed = scan.items ?? [];
      const toSave = parsed.length > 0 ? parsed : [{ name: "Produk 1", qty: 1, unit: null, unitPrice: 0, supplier: null, notaDate: null }];
      const r = await saveRawBatch({ batchId: scan.batchId, notaPhotoKey: scan.notaPhotoKey, items: toSave });
      if (!r.ok) setMsg(r.message ?? "Gagal simpan.");
      else setMsg(scan.ocr ? `Nota terbaca: ${parsed.length} item. Cek & edit di bawah.` : "OCR belum aktif — kartu kosong dibuat, isi manual.");
      router.refresh();
    } catch {
      setMsg("Gagal proses foto.");
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    setBusy(true);
    setMsg(null);
    const batchId = crypto.randomUUID();
    const r = await saveRawBatch({
      batchId,
      notaPhotoKey: null,
      items: [{ name: "Produk baru", qty: 1, unit: null, unitPrice: 0, supplier: null, notaDate: null }],
    });
    if (!r.ok) setMsg(r.message ?? "Gagal.");
    router.refresh();
    setBusy(false);
  }

  const drafts = items.filter((i) => i.status === "DRAFT");
  const others = items.filter((i) => i.status !== "DRAFT");
  const draftBatches = [...new Set(drafts.map((d) => d.batchId))];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-24 font-semibold">Produk Mentah</h1>
        <div className="flex gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Scan Nota
          </Button>
          <Button variant="secondary" onClick={addManual} disabled={busy}>
            <Plus className="h-4 w-4" /> Manual
          </Button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {msg && <p className="rounded-lg border bg-card p-3 text-14 text-muted-foreground">{msg}</p>}

      {/* Draft per batch — editable, bisa kirim ke QC */}
      {draftBatches.map((bid) => (
        <DraftBatch key={bid} batchId={bid} items={drafts.filter((d) => d.batchId === bid)} />
      ))}

      {/* Sudah dikirim / diproses */}
      {others.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-16 font-semibold">Riwayat</h2>
          {others.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-4">
              <div>
                <p className="font-medium">{i.name}</p>
                <p className="text-14 text-muted-foreground">
                  {i.qty} {i.unit ?? "pcs"} · Rp {rupiah.format(i.unitPrice)}
                  {i.supplier ? ` · ${i.supplier}` : ""}
                </p>
                {i.qcNote && (
                  <p className="mt-1 text-12 text-muted-foreground">
                    QC: {i.qcNote}
                    {i.qcByName ? ` — ${i.qcByName}` : ""}
                  </p>
                )}
              </div>
              <Badge variant={statusVariant(i.status)}>{STATUS_LABEL[i.status]}</Badge>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
          Belum ada produk. Scan nota atau tambah manual.
        </p>
      )}
    </div>
  );
}

function DraftBatch({ batchId, items }: { batchId: string; items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function kirim() {
    if (!confirm("Kirim semua item batch ini ke Quality Control?")) return;
    start(async () => {
      const r = await submitBatchToQc(batchId);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Draft · {items.length} item</Badge>
        <Button size="sm" disabled={pending} onClick={kirim}>
          Kirim ke QC
        </Button>
      </div>
      {items.map((i) => (
        <DraftCard key={i.id} item={i} />
      ))}
    </div>
  );
}

function DraftCard({ item }: { item: Item }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.qty));
  const [unit, setUnit] = useState(item.unit ?? "");
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));
  const [supplier, setSupplier] = useState(item.supplier ?? "");
  const [notaDate, setNotaDate] = useState(item.notaDate ?? "");

  function save() {
    start(async () => {
      const r = await updateRawProduct(item.id, {
        name,
        qty: Number(qty),
        unit: unit || null,
        unitPrice: Number(unitPrice),
        supplier: supplier || null,
        notaDate: notaDate || null,
      });
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }
  function hapus() {
    if (!confirm("Hapus kartu ini?")) return;
    start(async () => {
      const r = await deleteRawProduct(item.id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama produk" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Satuan" />
        <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Harga satuan" />
        <Input type="date" value={notaDate} onChange={(e) => setNotaDate(e.target.value)} />
      </div>
      <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier" />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" disabled={pending} onClick={save}>
          Simpan
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={hapus}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
