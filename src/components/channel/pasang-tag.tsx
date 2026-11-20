"use client";

import { useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { lookupSku, pairTags, unpairTags, whoseTags, type SkuInfo } from "@/server/actions/rfid";

// EPC stiker UHF = hex 24–32 huruf; barcode barang (EAN/UPC/SKU) lebih pendek → dianggap SKU.
const isTag = (v: string) => /^[0-9A-F]{24,32}$/i.test(v);
type Sesi = { read: Set<string>; added: string[]; already: number; other: { epc: string; sku: string }[] };
const baru = (): Sesi => ({ read: new Set(), added: [], already: 0, other: [] });

export function PasangTag() {
  const [sku, setSku] = useState<SkuInfo | null>(null);
  const [sesi, setSesi] = useState<Sesi>(baru);
  const [lepas, setLepas] = useState<{ sku: string; n: number }[] | null>(null);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const skuRef = useRef<SkuInfo | null>(null);
  const sesiRef = useRef<Sesi>(baru());
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Semua kerja server antre satu per satu (sapuan cepat = puluhan kode beruntun).
  const queue = useRef(Promise.resolve());

  const enqueue = (fn: () => Promise<void>) => {
    setBusy((b) => b + 1);
    queue.current = queue.current
      .then(fn)
      .then(() => setErr(""))
      .catch(() => setErr("Gagal tersimpan. Cek koneksi lalu sapu ulang."))
      .finally(() => setBusy((b) => b - 1));
  };
  const pushSesi = (s: Sesi) => { sesiRef.current = s; setSesi(s); };

  // Kode tag dikumpulkan dulu, dikirim sekali setelah reader berhenti ±0,7 detik.
  function flush() {
    clearTimeout(timer.current);
    const list = pending.current;
    pending.current = [];
    if (!list.length) return;
    enqueue(async () => {
      const cur = skuRef.current;
      if (!cur) return setLepas(await whoseTags(list));
      const r = await pairTags(list, cur.sku).catch((e) => {
        list.forEach((x) => sesiRef.current.read.delete(x)); // gagal → boleh disapu ulang
        throw e;
      });
      const s = sesiRef.current;
      pushSesi({ ...s, added: [...s.added, ...r.added], already: s.already + r.already, other: [...s.other, ...r.other] });
      setSku((x) => (x ? { ...x, tags: r.tags } : x));
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = val.trim();
    setVal("");
    if (!code) return;
    if (isTag(code)) {
      const up = code.toUpperCase();
      if (sesiRef.current.read.has(up)) return;
      sesiRef.current.read.add(up);
      setSesi({ ...sesiRef.current });
      pending.current.push(up);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
      return;
    }
    flush();
    enqueue(async () => {
      const info = await lookupSku(code);
      skuRef.current = info;
      setSku(info);
      setLepas(null);
      pushSesi(baru());
    });
  }

  const pindah = () => {
    const s = sesiRef.current, cur = skuRef.current;
    if (!cur || !confirm(`Pindahkan ${s.other.length} tag ke SKU ${cur.sku}?`)) return;
    enqueue(async () => {
      const r = await pairTags(s.other.map((o) => o.epc), cur.sku, true);
      pushSesi({ ...sesiRef.current, added: [...sesiRef.current.added, ...r.added], other: [] });
      setSku((x) => (x ? { ...x, tags: r.tags } : x));
    });
  };
  const batal = () => {
    const s = sesiRef.current, cur = skuRef.current;
    if (!cur || !confirm(`Lepas ${s.added.length} tag yang baru dipasang di sapuan ini?`)) return;
    enqueue(async () => {
      const r = await unpairTags(s.added, cur.sku);
      pushSesi(baru());
      setSku((x) => (x ? { ...x, tags: r.tags } : x));
    });
  };
  const ganti = () => { flush(); skuRef.current = null; setSku(null); pushSesi(baru()); };

  const selisih = sku?.stock != null ? sku.tags - sku.stock : null;
  return (
    <div className="space-y-4" onClick={() => input.current?.focus()}>
      <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border bg-card p-3">
        <ScanLine className="size-5 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={sku ? "Sapu semua stiker barang ini… (scan barcode lain = ganti SKU)" : "Scan barcode SKU barang / ketik SKU lalu Enter"}
          aria-label="Scan"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-14"
        />
        {busy > 0 && <span className="text-12 text-muted-foreground">Menyimpan…</span>}
      </form>
      {err && <p className="rounded-md bg-red-500/10 px-3 py-2 text-14 text-red-600">{err}</p>}

      {sku ? (
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <div className="flex gap-3">
            {sku.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
              <img src={sku.image} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
            ) : (
              <span className="size-16 shrink-0 rounded-md bg-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-12 text-muted-foreground">SKU {sku.sku}</p>
              <p className="font-medium leading-snug">{sku.name ?? <span className="text-amber-600">SKU tidak ada di Produk Master — tag tetap bisa dipasang.</span>}</p>
              {sku.stocks.length > 1 && <p className="text-12 text-muted-foreground">{sku.stocks.map((s) => `${s.label} ${s.stock}`).join(" · ")}</p>}
            </div>
            <button type="button" onClick={ganti} className="self-start text-12 text-primary">Ganti SKU</button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted p-2"><p className="text-24 font-semibold">{sku.tags}</p><p className="text-12 text-muted-foreground">tag terpasang</p></div>
            <div className="rounded-md bg-muted p-2"><p className="text-24 font-semibold">{sku.stock ?? "–"}</p><p className="text-12 text-muted-foreground">stok sistem</p></div>
            <div className={`rounded-md p-2 ${selisih == null ? "bg-muted" : selisih === 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
              <p className="text-24 font-semibold">{selisih == null ? "–" : selisih === 0 ? "Cocok" : selisih > 0 ? `+${selisih}` : selisih}</p>
              <p className="text-12">{selisih == null ? "selisih" : selisih === 0 ? "tag = stok" : selisih > 0 ? "tag lebih dari stok" : "tag kurang dari stok"}</p>
            </div>
          </div>

          {sesi.read.size > 0 && (
            <div className="space-y-2 rounded-md border p-2 text-14">
              <p>Sapuan ini: <b>{sesi.read.size}</b> terbaca · <b>{sesi.added.length}</b> baru dipasang · {sesi.already} sudah terpasang</p>
              {sesi.other.length > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {sesi.other.length} tag milik SKU lain ({[...new Set(sesi.other.map((o) => o.sku))].slice(0, 3).join(", ")}) — tidak dipindah.{" "}
                  <button type="button" onClick={pindah} className="underline">Pindahkan ke SKU ini</button>
                </p>
              )}
              {sesi.added.length > 0 && <button type="button" onClick={batal} className="text-12 text-red-600 underline">Batalkan sapuan ini (lepas {sesi.added.length} tag baru)</button>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed p-4 text-14 text-muted-foreground">
          <p>1. Scan barcode barang → muncul produk & stok sistem.<br />2. Sapu semua stiker barang itu sekaligus → tersimpan & langsung dibandingkan dengan stok.</p>
          {lepas && (
            <p className="text-foreground">
              Tanpa SKU dipilih — tag terbaca: {lepas.map((x) => (x.sku ? `${x.n} milik SKU ${x.sku}` : `${x.n} belum terpasang`)).join(" · ")}
            </p>
          )}
        </div>
      )}
      <p className="text-12 text-muted-foreground">Jauhkan gulungan stiker & barang lain yang sudah bertag dari reader saat menyapu, supaya tidak ikut terbaca.</p>
    </div>
  );
}
