"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { compressImage } from "@/lib/image";
import { computeSellPrice } from "@/lib/pricing";
import { stripSize, groupKey } from "@/lib/raw-group";
import { BRANDS, brandByKey } from "@/lib/distributors";
import {
  scanNota,
  saveRawBatch,
  saveRawItems,
  updateRawProduct,
  deleteRawProduct,
  deleteAllHistory,
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-12 text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function FinanceClient({ items, isBoss }: { items: Item[]; isBoss: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [brandKey, setBrandKey] = useState(""); // brand nota yang dipilih (wajib sebelum scan/manual)

  async function onPick(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      // Nota PDF: kirim apa adanya (tak bisa di-rasterize canvas). Foto: kompres dulu.
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const mime = isPdf ? "application/pdf" : "image/jpeg";
      const b64 = await blobToBase64(isPdf ? file : await compressImage(file));
      const scan = await scanNota(b64, mime, brandKey);
      if (!scan.ok || !scan.batchId) {
        setMsg(scan.message ?? "Scan gagal.");
        return;
      }
      const b = brandByKey(brandKey);
      const parsed = scan.items ?? [];
      // Stempel brand+distributor pilihan sebagai label (kalau OCR kosong).
      const toSave = (parsed.length > 0 ? parsed : [EMPTY_ITEM]).map((it) => ({
        ...it,
        brand: it.brand ?? b?.brand ?? null,
        supplier: it.supplier ?? b?.distributor ?? null,
      }));
      const r = await saveRawBatch({ batchId: scan.batchId, notaPhotoKey: scan.notaPhotoKey, items: toSave });
      if (!r.ok) setMsg(r.message ?? "Gagal simpan.");
      else setMsg(scan.ocr ? `Nota terbaca: ${parsed.length} item. Cek & edit di bawah.` : "OCR belum aktif — kartu kosong dibuat, isi manual.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? `Gagal proses nota: ${e.message}` : "Gagal proses nota.");
    } finally {
      setBusy(false);
    }
  }

  function delHistory(id: string) {
    if (!confirm("Hapus item riwayat ini? Tidak bisa dibatalkan.")) return;
    deleteRawProduct(id).then((r) => {
      if (!r.ok) alert(r.message ?? "Gagal hapus.");
      router.refresh();
    });
  }
  function delAllHistory() {
    if (!confirm("Hapus SEMUA item riwayat? Tidak bisa dibatalkan.")) return;
    deleteAllHistory().then((r) => {
      if (!r.ok) alert(r.message ?? "Gagal hapus.");
      router.refresh();
    });
  }

  async function addManual() {
    setBusy(true);
    setMsg(null);
    const batchId = crypto.randomUUID();
    const b = brandByKey(brandKey);
    const r = await saveRawBatch({
      batchId,
      notaPhotoKey: null,
      items: [{ ...EMPTY_ITEM, name: "Produk baru", brand: b?.brand ?? null, supplier: b?.distributor ?? null }],
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
        <h1 className="text-24 font-semibold">Purchasing</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={brandKey}
            onChange={(e) => setBrandKey(e.target.value)}
            className="h-9 rounded-md border bg-card px-2 text-14"
            aria-label="Brand nota"
          >
            <option value="">— Pilih brand nota —</option>
            {BRANDS.map((b) => (
              <option key={b.key} value={b.key} disabled={!b.trained}>
                {b.brand} · {b.distributor}
              </option>
            ))}
          </select>
          <Button onClick={() => fileRef.current?.click()} disabled={busy || !brandKey}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Scan Nota
          </Button>
          <Button variant="secondary" onClick={addManual} disabled={busy || !brandKey}>
            <Plus className="h-4 w-4" /> Manual
          </Button>
        </div>
      </div>
      {!brandKey && <p className="text-12 text-muted-foreground">Pilih brand nota dulu sebelum scan / input manual.</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-16 font-semibold">Riwayat</h2>
            {isBoss && (
              <Button size="sm" variant="ghost" onClick={delAllHistory}>
                <Trash2 className="mr-1 h-4 w-4" /> Hapus semua
              </Button>
            )}
          </div>
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
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={statusVariant(i.status)}>{STATUS_LABEL[i.status]}</Badge>
                {isBoss && (
                  <Button size="sm" variant="ghost" onClick={() => delHistory(i.id)}>
                    <Trash2 className="h-4 w-4" /> Hapus
                  </Button>
                )}
              </div>
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
  // Normalisasi: nama tanpa ukuran, supaya baris model+warna sama tergabung.
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((i) => ({ ...toRow(i), name: stripSize(i.name, i.size) })),
  );

  // Grup per model+warna; baris data tetap per ukuran.
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = groupKey(r);
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return [...m.values()];
  }, [rows]);

  // Edit field bersama → terapkan ke semua baris di grup.
  function setShared(ids: Set<string>, key: keyof Row, val: string) {
    setRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, [key]: val } : r)));
  }
  // Edit per ukuran (size/qty/sku) → satu baris.
  function setSize(id: string, key: keyof Row, val: string) {
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
    if (!confirm(`Hapus semua ${rows.length} item di batch ini?`)) return;
    start(async () => {
      const r = await deleteBatch(batchId);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }
  function saveGroup(g: Row[]) {
    start(async () => {
      const r = await saveRawItems(g.map((row) => ({ id: row.id, ...toFields(row) })));
      if (!r.ok) {
        alert(r.message);
        return;
      }
      for (const row of g) {
        const q = await submitItemToQc(row.id);
        if (!q.ok) {
          alert(q.message);
          break;
        }
      }
      router.refresh();
    });
  }
  function deleteSize(id: string) {
    start(async () => {
      const r = await deleteRawProduct(id);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setRows((rs) => rs.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">Draft · {groups.length} model · {rows.length} item</Badge>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={saveAll}>
            Kirim semua
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={deleteAll}>
            <Trash2 className="mr-1 h-4 w-4" /> Hapus semua
          </Button>
        </div>
      </div>
      {groups.map((g) => {
        const head = g[0];
        const ids = new Set(g.map((r) => r.id));
        const totalQty = g.reduce((s, r) => s + (Number(r.qty) || 0), 0);
        return (
          <div key={g.map((r) => r.id).sort().join(",")} className="space-y-2 rounded-md border p-3">
            <Field label="Nama barang">
              <Input value={head.name} onChange={(e) => setShared(ids, "name", e.target.value)} placeholder="Nama barang" />
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Merek">
                <Input value={head.brand} onChange={(e) => setShared(ids, "brand", e.target.value)} placeholder="Merek" />
              </Field>
              <Field label="Warna">
                <Input value={head.color} onChange={(e) => setShared(ids, "color", e.target.value)} placeholder="Warna" />
              </Field>
              <Field label="Satuan">
                <Input value={head.unit} onChange={(e) => setShared(ids, "unit", e.target.value)} placeholder="pcs" />
              </Field>
              <Field label="Harga/unit">
                <Input type="number" value={head.unitPrice} onChange={(e) => setShared(ids, "unitPrice", e.target.value)} placeholder="Harga/unit" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Supplier">
                <Input value={head.supplier} onChange={(e) => setShared(ids, "supplier", e.target.value)} placeholder="Supplier" />
              </Field>
              <Field label="Tanggal nota">
                <Input type="date" value={head.notaDate} onChange={(e) => setShared(ids, "notaDate", e.target.value)} />
              </Field>
            </div>

            <div className="space-y-1">
              <span className="block text-12 text-muted-foreground">Ukuran masuk ({totalQty} pcs)</span>
              {g.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_auto_1.2fr_auto] items-center gap-2">
                  <Input value={row.size} onChange={(e) => setSize(row.id, "size", e.target.value)} placeholder="Ukuran" />
                  <Input type="number" className="w-20" value={row.qty} onChange={(e) => setSize(row.id, "qty", e.target.value)} placeholder="Qty" />
                  <Input value={row.sku} onChange={(e) => setSize(row.id, "sku", e.target.value)} placeholder="SKU" />
                  <Button size="icon" variant="ghost" disabled={pending} onClick={() => deleteSize(row.id)} aria-label="Hapus ukuran">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-12 text-muted-foreground">
              Harga jual (×135%×115%, bulat 5rb): Rp {rupiah.format(computeSellPrice(Number(head.unitPrice) || 0))}
            </p>
            <Button size="sm" variant="secondary" className="w-full" disabled={pending} onClick={() => saveGroup(g)}>
              Simpan & Kirim ke QC
            </Button>
          </div>
        );
      })}
    </div>
  );
}
