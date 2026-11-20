"use client";

import { useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { lookupSku, pairTag, unpairTag, whoseTag } from "@/server/actions/rfid";

// EPC stiker UHF = hex 24–32 huruf; barcode barang (EAN/UPC/SKU) lebih pendek → dianggap SKU.
const isTag = (v: string) => /^[0-9A-F]{24,32}$/i.test(v);
type Sku = Awaited<ReturnType<typeof lookupSku>>;
type Log = { id: number; epc: string; ok: boolean; text: string };

export function PasangTag() {
  const [sku, setSku] = useState<Sku | null>(null);
  const [val, setVal] = useState("");
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  // Scan beruntun cepat → antre satu per satu (jaga hitungan & urutan).
  const queue = useRef(Promise.resolve());
  const skuRef = useRef<Sku | null>(null);
  const n = useRef(0);

  const add = (epc: string, ok: boolean, text: string) => setLog((l) => [{ id: ++n.current, epc, ok, text }, ...l].slice(0, 50));

  async function handle(code: string) {
    const cur = skuRef.current;
    if (!isTag(code)) {
      const info = await lookupSku(code);
      skuRef.current = info;
      setSku(info);
      return;
    }
    if (!cur) {
      const { sku: s } = await whoseTag(code);
      add(code, !!s, s ? `Tag ini milik SKU ${s}` : "Tag belum terpasang — scan barcode SKU dulu.");
      return;
    }
    let r = await pairTag(code, cur.sku);
    if (r.status === "milik-lain" && confirm(`${r.message}\nPindahkan ke ${cur.sku}?`)) r = await pairTag(code, cur.sku, true);
    add(code, r.ok, r.message);
    if (r.tags != null && skuRef.current?.sku === cur.sku) setSku((s) => (s ? { ...s, tags: r.tags! } : s));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = val.trim();
    setVal("");
    if (!code) return;
    setBusy((b) => b + 1);
    queue.current = queue.current
      .then(() => handle(code))
      .catch(() => add(code, false, "Gagal tersimpan. Cek koneksi lalu scan ulang."))
      .finally(() => setBusy((b) => b - 1));
  }

  async function lepas(epc: string) {
    await unpairTag(epc);
    add(epc, true, "Tag dilepas.");
    if (skuRef.current) setSku(await lookupSku(skuRef.current.sku));
  }

  return (
    <div className="space-y-4" onClick={() => input.current?.focus()}>
      <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border bg-card p-3">
        <ScanLine className="size-5 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={sku ? "Scan stiker RFID… (atau barcode lain untuk ganti SKU)" : "Scan barcode SKU barang / ketik SKU lalu Enter"}
          aria-label="Scan"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-14"
        />
        {busy > 0 && <span className="text-12 text-muted-foreground">Menyimpan…</span>}
      </form>

      {sku ? (
        <div className="flex gap-3 rounded-lg border bg-card p-3">
          {sku.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
            <img src={sku.image} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
          ) : (
            <span className="size-16 shrink-0 rounded-md bg-muted" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-12 text-muted-foreground">SKU {sku.sku}</p>
            <p className="font-medium leading-snug">{sku.name ?? <span className="text-amber-600">SKU tidak ada di Produk Master — tag tetap bisa dipasang.</span>}</p>
            {sku.variant && <p className="text-12 text-muted-foreground">{sku.variant}</p>}
          </div>
          <div className="text-right">
            <p className="text-24 font-semibold leading-none">{sku.tags}</p>
            <p className="text-12 text-muted-foreground">tag</p>
            <button type="button" onClick={() => { skuRef.current = null; setSku(null); }} className="mt-2 text-12 text-primary">Ganti SKU</button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-14 text-muted-foreground">Belum ada SKU dipilih. Scan barcode barang dulu, lalu scan stikernya satu per satu.</p>
      )}

      {log.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card text-14">
          {log.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`size-2 shrink-0 rounded-full ${l.ok ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
              <span className="shrink-0 font-mono text-12">{l.epc.slice(-8)}</span>
              <span className="min-w-0 flex-1 truncate">{l.text}</span>
              {l.ok && sku && l.text !== "Tag dilepas." && (
                <button type="button" onClick={() => lepas(l.epc)} className="text-muted-foreground" aria-label="Lepas tag">
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
