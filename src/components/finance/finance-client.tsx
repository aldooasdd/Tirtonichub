"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { compressImage } from "@/lib/image";
import { computeSellPrice } from "@/lib/pricing";
import {
  scanNota,
  saveRawBatch,
  saveRawItems,
  updateRawProduct,
  deleteRawProduct,
  deleteBatch,
  submitItemToQc,
  submitBatchToQc,
} from "@/server/actions/raw-products";

type Item = {
  id: string;
  batchId: string;
  name: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  qty: number;
  unit: string | null;
  unitPrice: number;
  sellPrice: number | null;
  supplier: string | null;
  notaDate: string | null;
  status: "DRAFT" | "QC" | "STOCK" | "REJECTED";
  qcNote: string | null;
  qcByName: string | null;
};

const EMPTY_ITEM = { name: "Produk 1", brand: null, color: null, size: null, sku: null, qty: 1, unit: null, unitPrice: 0, supplier: null, notaDate: null };

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
      const toSave = parsed.length > 0 ? parsed : [EMPTY_ITEM];
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
      items: [{ ...EMPTY_ITEM, name: "Produk baru" }],
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
      {draftBatches.map((bid) => {
        const bi = drafts.filter((d) => d.batchId === bid);
        return <DraftBatch key={bid + ":" + bi.map((i) => i.id).join(",")} batchId={bid} items={bi} />;
      })}

      {/* Sudah dikirim / diproses */}
      {others.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-16 font-semibold">Riwayat</h2>
          {others.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-4">
              <div>
                <p className="font-medium">{i.name}</p>
                {(i.brand || i.color || i.size || i.sku) && (
                  <p className="text-12 text-muted-foreground">
                    {[i.brand, i.color, i.size, i.sku ? `SKU ${i.sku}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="text-14 text-muted-foreground">
                  {i.qty} {i.unit ?? "pcs"} · Rp {rupiah.format(i.unitPrice)}
                  {i.supplier ? ` · ${i.supplier}` : ""}
                </p>
                {i.sellPrice != null && (
                  <p className="text-12 font-medium">Jual: Rp {rupiah.format(i.sellPrice)}</p>
                )}
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

type Row = {
  id: string;
  name: string;
  brand: string;
  color: string;
  size: string;
  sku: string;
  qty: string;
  unit: string;
  unitPrice: string;
  supplier: string;
  notaDate: string;
};
function toRow(i: Item): Row {
  return {
    id: i.id,
    name: i.name,
    brand: i.brand ?? "",
    color: i.color ?? "",
    size: i.size ?? "",
    sku: i.sku ?? "",
    qty: String(i.qty),
    unit: i.unit ?? "",
    unitPrice: String(i.unitPrice),
    supplier: i.supplier ?? "",
    notaDate: i.notaDate ?? "",
  };
}
function toFields(r: Row) {
  return {
    name: r.name,
    brand: r.brand || null,
    color: r.color || null,
    size: r.size || null,
    sku: r.sku || null,
    qty: Number(r.qty),
    unit: r.unit || null,
    unitPrice: Number(r.unitPrice),
    supplier: r.supplier || null,
    notaDate: r.notaDate || null,
  };
}

function DraftBatch({ batchId, items }: { batchId: string; items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => items.map(toRow));

  function setField(id: string, key: keyof Row, val: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }

  function saveAll() {
    start(async () => {
      const r = await saveRawItems(rows.map((row) => ({ id: row.id, ...toFields(row) })));
      if (!r.ok) {
        alert(r.message);
        return;
      }
      const q = await submitBatchToQc(batchId);
      if (!q.ok) alert(q.message);
      router.refresh();
    });
  }
  function deleteAll() {
    if (!confirm(`Hapus semua ${rows.length} kartu di batch ini?`)) return;
    start(async () => {
      const r = await deleteBatch(batchId);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }
  function saveOne(row: Row) {
    start(async () => {
      const r = await updateRawProduct(row.id, toFields(row));
      if (!r.ok) {
        alert(r.message);
        return;
      }
      const q = await submitItemToQc(row.id);
      if (!q.ok) alert(q.message);
      router.refresh();
    });
  }
  function deleteOne(id: string) {
    if (!confirm("Hapus kartu ini?")) return;
    start(async () => {
      const r = await deleteRawProduct(id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">Draft · {rows.length} item</Badge>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={saveAll}>
            Simpan semua & Kirim ke QC
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={deleteAll}>
            <Trash2 className="mr-1 h-4 w-4" /> Hapus semua
          </Button>
        </div>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="space-y-2 rounded-md border p-3">
          <Input value={row.name} onChange={(e) => setField(row.id, "name", e.target.value)} placeholder="Nama barang" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input value={row.brand} onChange={(e) => setField(row.id, "brand", e.target.value)} placeholder="Merek" />
            <Input value={row.color} onChange={(e) => setField(row.id, "color", e.target.value)} placeholder="Warna" />
            <Input value={row.size} onChange={(e) => setField(row.id, "size", e.target.value)} placeholder="Ukuran" />
            <Input value={row.sku} onChange={(e) => setField(row.id, "sku", e.target.value)} placeholder="SKU" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="number" value={row.qty} onChange={(e) => setField(row.id, "qty", e.target.value)} placeholder="Qty" />
            <Input value={row.unit} onChange={(e) => setField(row.id, "unit", e.target.value)} placeholder="Satuan (pcs)" />
            <Input type="number" value={row.unitPrice} onChange={(e) => setField(row.id, "unitPrice", e.target.value)} placeholder="Harga/unit" />
            <Input type="date" value={row.notaDate} onChange={(e) => setField(row.id, "notaDate", e.target.value)} />
          </div>
          <Input value={row.supplier} onChange={(e) => setField(row.id, "supplier", e.target.value)} placeholder="Supplier" />
          <p className="text-12 text-muted-foreground">
            Harga jual (×135%×115%, bulat 5rb): Rp {rupiah.format(computeSellPrice(Number(row.unitPrice) || 0))}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1" disabled={pending} onClick={() => saveOne(row)}>
              Simpan & Kirim ke QC
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => deleteOne(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
