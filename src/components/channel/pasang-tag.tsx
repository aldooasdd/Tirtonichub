"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save, ScanLine, X } from "lucide-react";
import { cariBarang, gantiSku, lookupSku, ownersOf, pairTags, pemakaiSku, type Barang, type SkuInfo } from "@/server/actions/rfid";

// EPC stiker UHF = hex 24–32 huruf; barcode barang (EAN/UPC/SKU) lebih pendek → dianggap SKU.
const isTag = (v: string) => /^[0-9A-F]{24,32}$/i.test(v);
const MAX_ROWS = 300; // batas baris kosong; 999 = stok web "tak terbatas"
type Draft = { epc: string; owner: string | null; move: boolean }; // owner = SKU lain pemilik tag
const siap = (d: Draft) => !d.owner || d.move;

/** SKU belum terdaftar, atau barangnya salah (edit) → cari & pilih barang; SKU barang itu diganti SKU hasil scan. */
function PilihBarang({ sku, edit, disabled, onPick, onClose }: { sku: string; edit: boolean; disabled: boolean; onPick: (b: Barang) => void; onClose: () => void }) {
  const [pilihan, setPilihan] = useState<Barang | null>(null);
  const [pakai, setPakai] = useState<string[] | null>(null);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Barang[] | null>(null);
  const [err, setErr] = useState(false);
  const cur = useRef("");
  useEffect(() => {
    if (!edit) return;
    let on = true;
    pemakaiSku(sku).then((r) => on && setPakai(r)).catch(() => on && setErr(true));
    return () => { on = false; };
  }, [edit, sku]);
  useEffect(() => {
    const s = q.trim();
    cur.current = s;
    if (s.length < 2) return;
    const t = setTimeout(async () => {
      try {
        const r = await cariBarang(s);
        if (cur.current === s) { setList(r); setErr(false); }
      } catch {
        if (cur.current === s) setErr(true);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const show = q.trim().length >= 2;
  return (
    <div className="space-y-2 border-t bg-amber-500/5 p-3" onClick={(e) => e.stopPropagation()}>
      {edit ? (
        <div className="flex items-start justify-between gap-3 text-14">
          <div>
            <p>Pilih barang yang benar untuk SKU <b className="font-mono">{sku}</b>. Barang lain yang sekarang memakai SKU ini akan jadi tanpa SKU:</p>
            <ul className="mt-1 list-disc pl-5 text-12 text-muted-foreground">{pakai ? pakai.map((x, i) => <li key={i}>{x}</li>) : <li>Memuat…</li>}</ul>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 underline">Batal</button>
        </div>
      ) : (
        <p className="text-14">SKU <b className="font-mono">{sku}</b> belum ada di Produk Master. Pilih barangnya, SKU barang itu langsung diganti dengan SKU ini.</p>
      )}
      {pilihan && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary p-2 text-14">
          <span className="min-w-0 flex-1">Ganti ke <b>{pilihan.name}</b>{pilihan.variant ? ` · ${pilihan.variant}` : ""}?</span>
          <button type="button" disabled={disabled || !pakai} onClick={() => onPick(pilihan)} className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-40">Ya, ganti</button>
          <button type="button" onClick={() => setPilihan(null)} className="h-9 rounded-md border px-4">Batal</button>
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama barang / varian / SKU lama"
        aria-label="Cari barang"
        autoComplete="off"
        className="h-10 w-full rounded-full border bg-background px-4 text-14"
      />
      {err && <p className="text-12 text-red-600">Gagal memuat. Cek koneksi lalu ketik ulang.</p>}
      {show && list && (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border bg-background">
          {list.length === 0 && <li className="p-3 text-14 text-muted-foreground">Barang tidak ketemu.</li>}
          {list.map((b) => (
            <li key={b.id}>
              <button type="button" disabled={disabled} onClick={() => (edit ? setPilihan(b) : onPick(b))} className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted disabled:opacity-40">
                {b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                  <img src={b.image} alt="" className="size-10 shrink-0 rounded border object-cover" />
                ) : (
                  <span className="size-10 shrink-0 rounded bg-muted" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block text-14 font-medium leading-snug">{b.name}</span>
                  <span className="block text-12 text-muted-foreground">{b.variant ? `${b.variant} · ` : ""}{b.skus.length ? `SKU ${b.skus.join(", ")}` : "Belum ada SKU"} · {b.shops.join(", ")}</span>
                </span>
              </button>
            </li>
          ))}
          {list.length === 50 && <li className="p-2 text-12 text-muted-foreground">Hanya 50 hasil pertama. Ketik lebih lengkap.</li>}
        </ul>
      )}
    </div>
  );
}

// Tanpa confirm(): reader mengetik Enter, dialog bisa ter-OK sendiri.
export function PasangTag() {
  const [sku, setSku] = useState<SkuInfo | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [next, setNext] = useState<string | null>(null); // barcode baru di-scan saat tag belum disimpan
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const skuRef = useRef<SkuInfo | null>(null);
  const draftRef = useRef<Draft[]>([]);
  const nextRef = useRef<string | null>(null);
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Semua kerja server antre satu per satu, supaya tag tidak masuk ke SKU yang salah.
  const queue = useRef(Promise.resolve());

  const putSku = (s: SkuInfo | null) => { skuRef.current = s; setSku(s); };
  const putDrafts = (d: Draft[]) => { draftRef.current = d; setDrafts(d); };
  const putNext = (s: string | null) => { nextRef.current = s; setNext(s); };

  useEffect(() => {
    if (!drafts.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts.length]);

  const enqueue = (fn: () => Promise<void>) => {
    setBusy((b) => b + 1);
    queue.current = queue.current
      .then(fn)
      .catch(() => setMsg({ ok: false, text: "Gagal. Cek koneksi lalu ulangi." }))
      .finally(() => setBusy((b) => b - 1));
  };

  async function open(code: string) {
    putSku(null); // lookup gagal → jangan sampai tag masuk ke SKU lama
    putDrafts([]);
    putNext(null);
    setEdit(false);
    putSku(await lookupSku(code));
    setMsg(null);
  }

  // Kode tag dikumpulkan sebentar lalu dicek pemiliknya sekaligus.
  function flush() {
    clearTimeout(timer.current);
    const list = [...new Set(pending.current)];
    pending.current = [];
    if (!list.length) return;
    enqueue(async () => {
      if (nextRef.current) return setMsg({ ok: false, text: `${list.length} tag tidak dimasukkan. Simpan atau buang dulu tag barang sebelumnya.` });
      const cur = skuRef.current;
      const owner = new Map((await ownersOf(list)).map((o) => [o.epc, o.sku]));
      if (!cur) {
        const n = new Map<string, number>();
        for (const e of list) n.set(owner.get(e) ?? "", (n.get(owner.get(e) ?? "") ?? 0) + 1);
        return setMsg({ ok: true, text: `Belum pilih SKU. Tag terbaca: ${[...n].map(([s, c]) => (s ? `${c} milik SKU ${s}` : `${c} belum terpasang`)).join(" · ")}` });
      }
      const have = new Set([...cur.tagList, ...draftRef.current.map((d) => d.epc)]);
      const baru = list.filter((e) => !have.has(e));
      putDrafts([...draftRef.current, ...baru.map((epc) => ({ epc, owner: owner.get(epc) ?? null, move: false }))]);
      const dobel = list.length - baru.length;
      setMsg({ ok: true, text: `${baru.length} tag masuk${dobel ? ` · ${dobel} sudah ada di daftar` : ""}. Belum disimpan.` });
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = val.trim();
    setVal("");
    if (!code) return;
    if (isTag(code)) {
      pending.current.push(code.toUpperCase());
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
      return;
    }
    flush();
    enqueue(async () => {
      if (draftRef.current.length) {
        if (code.toLowerCase() !== skuRef.current?.sku.toLowerCase()) putNext(code);
        return;
      }
      await open(code);
    });
  }

  async function simpan() {
    const cur = skuRef.current;
    if (!cur) return;
    const list = draftRef.current;
    const baru = list.filter((d) => !d.owner).map((d) => d.epc);
    const pindah = list.filter((d) => d.owner && d.move).map((d) => d.epc);
    if (!baru.length && !pindah.length) return;
    let r = await pairTags(baru, cur.sku);
    const other = new Map(r.other.map((o) => [o.epc, o.sku])); // keburu dipasang orang lain
    if (pindah.length) r = await pairTags(pindah, cur.sku, true);
    const saved = new Set(r.tagList);
    const rest = list.filter((d) => !saved.has(d.epc)).map((d) => ({ ...d, owner: other.get(d.epc) ?? d.owner }));
    putDrafts(rest);
    putSku({ ...cur, tagList: r.tagList });
    setMsg({ ok: !rest.length, text: `${list.length - rest.length} tag tersimpan.${rest.length ? ` ${rest.length} milik SKU lain belum disimpan.` : ""}` });
  }
  const klikSimpan = () => { flush(); enqueue(simpan); };
  const lanjut = (save: boolean) => {
    flush();
    enqueue(async () => {
      const code = nextRef.current;
      if (!code) return;
      if (save) await simpan();
      // Tag milik SKU lain yang tidak dipindah memang tidak disimpan.
      await open(code);
    });
  };
  const pilih = (b: Barang) => {
    flush();
    const s = skuRef.current?.sku;
    if (!s) return;
    enqueue(async () => {
      const r = await gantiSku(b.id, s, edit);
      // Tag yang belum disimpan tetap di daftar (SKU-nya sama).
      if (r.ok) {
        const info = await lookupSku(s);
        putSku(info);
        putDrafts(draftRef.current.filter((d) => !info.tagList.includes(d.epc)));
      }
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) setEdit(false);
      if (r.ok) input.current?.focus();
    });
  };
  const hapus = (epc: string) => putDrafts(draftRef.current.filter((d) => d.epc !== epc));
  const pindahkan = (epc: string) => putDrafts(draftRef.current.map((d) => (d.epc === epc ? { ...d, move: !d.move } : d)));

  const isi = sku ? sku.tagList.length + drafts.length : 0;
  const stok = sku?.stock != null && sku.stock < 999 ? sku.stock : null;
  const kosong = Math.max(0, Math.min(stok ?? 0, MAX_ROWS) - isi);
  const nSiap = drafts.filter(siap).length;
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-14 font-medium disabled:opacity-40";
  const lebih = (i: number) => (stok != null && i >= stok ? <span className="text-amber-600"> · lebih dari stok</span> : null);

  return (
    <div className="space-y-4" onClick={() => input.current?.focus()}>
      <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border bg-card p-3">
        <ScanLine className="size-5 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={sku ? "Sapu stiker barang ini… (scan barcode lain = ganti SKU)" : "Scan barcode SKU barang / ketik SKU lalu Enter"}
          aria-label="Scan"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-14"
        />
        {busy > 0 && <span className="text-12 text-muted-foreground">Memproses…</span>}
      </form>

      {next && (
        <div className="space-y-2 rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-14">
          <p>Barcode <b className="font-mono">{next}</b> terbaca, tapi {drafts.length} tag untuk SKU {sku?.sku} belum disimpan.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy > 0} onClick={() => lanjut(true)} className={`${btn} bg-primary text-primary-foreground`}>Simpan {nSiap} tag, lalu ganti</button>
            <button type="button" disabled={busy > 0} onClick={() => lanjut(false)} className={`${btn} border text-destructive`}>Buang, lalu ganti</button>
            <button type="button" onClick={() => putNext(null)} className={`${btn} border`}>Tetap di SKU ini</button>
          </div>
        </div>
      )}
      {msg && <p role="status" className={`rounded-md px-3 py-2 text-14 ${msg.ok ? "bg-muted" : "bg-red-500/10 text-red-600"}`}>{msg.text}</p>}

      {sku ? (
        <div className="rounded-lg border bg-card">
          <div className="flex gap-3 p-3">
            {sku.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
              <img src={sku.image} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
            ) : (
              <span className="size-16 shrink-0 rounded-md bg-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-12 text-muted-foreground">SKU {sku.sku}</p>
              <p className="font-medium leading-snug">{sku.name ?? <span className="text-amber-600">SKU tidak ada di Produk Master</span>}</p>
              {sku.variant && <p className="text-12 text-muted-foreground">{sku.variant}</p>}
              {sku.stocks.length > 0 && <p className="text-12 text-muted-foreground">Stok: {sku.stocks.map((s) => `${s.label} ${s.stock}`).join(" · ")}</p>}
            </div>
            {sku.name && !edit && (
              <button type="button" disabled={busy > 0} onClick={(e) => { e.stopPropagation(); setEdit(true); }} className={`${btn} shrink-0 self-start border`}>
                <Pencil className="size-4" /> Edit barang
              </button>
            )}
          </div>

          {(!sku.name || edit) && <PilihBarang key={`${sku.sku}|${edit}`} sku={sku.sku} edit={edit} disabled={busy > 0} onPick={pilih} onClose={() => setEdit(false)} />}

          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-y bg-card px-3 py-2 text-14">
            <span>Terisi <b>{isi}</b>{stok != null ? ` dari ${stok} stok` : ""} · {sku.tagList.length} tersimpan{drafts.length ? ` · ${drafts.length} belum disimpan` : ""}</span>
            <span className="flex gap-2">
              {drafts.length > 0 && <button type="button" disabled={busy > 0} onClick={() => putDrafts([])} className={`${btn} border`}>Kosongkan</button>}
              <button type="button" disabled={busy > 0 || nSiap === 0} onClick={klikSimpan} className={`${btn} bg-primary text-primary-foreground`}>
                <Save className="size-4" /> Simpan{nSiap ? ` (${nSiap})` : ""}
              </button>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-14">
              <thead>
                <tr className="text-left text-12 text-muted-foreground"><th className="w-12 px-3 py-2">No</th><th className="px-3 py-2">ID Tag</th><th className="px-3 py-2">Status</th><th className="w-10" /></tr>
              </thead>
              <tbody>
                {sku.tagList.map((e, i) => (
                  <tr key={e} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-12">{e}</td>
                    <td className="px-3 py-2 text-emerald-600">Tersimpan{lebih(i)}</td>
                    <td />
                  </tr>
                ))}
                {drafts.map((d, j) => {
                  const i = sku.tagList.length + j;
                  return (
                    <tr key={d.epc} className="border-t bg-amber-500/5">
                      <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-12">{d.epc}</td>
                      <td className="px-3 py-2">
                        {d.owner ? (
                          <>
                            <span className="text-red-600">Milik SKU {d.owner}</span>{" "}
                            <button type="button" onClick={() => pindahkan(d.epc)} className="underline">{d.move ? "Batal pindah" : "Pindahkan ke sini"}</button>
                          </>
                        ) : (
                          <span className="text-amber-600">Belum disimpan</span>
                        )}
                        {lebih(i)}
                      </td>
                      <td><button type="button" disabled={busy > 0} onClick={() => hapus(d.epc)} aria-label={`Hapus tag ${d.epc}`} className="p-2 text-muted-foreground"><X className="size-4" /></button></td>
                    </tr>
                  );
                })}
                {Array.from({ length: kosong }, (_, j) => (
                  <tr key={`k${j}`} className="border-t text-muted-foreground">
                    <td className="px-3 py-2 tabular-nums">{isi + j + 1}</td>
                    <td className="px-3 py-2"><span className="block h-6 rounded border border-dashed" /></td>
                    <td className="px-3 py-2 text-12">Menunggu scan</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
            {stok != null && stok > MAX_ROWS && <p className="border-t px-3 py-2 text-12 text-muted-foreground">Baris kosong ditampilkan sampai {MAX_ROWS}; baris berikutnya muncul saat tag terbaca.</p>}
            {stok == null && isi === 0 && <p className="border-t px-3 py-2 text-12 text-muted-foreground">Stok tidak diketahui — baris muncul saat tag terbaca.</p>}
            {stok === 0 && isi === 0 && <p className="border-t px-3 py-2 text-12 text-muted-foreground">Stok sistem 0 — tag tetap bisa di-scan.</p>}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-14 text-muted-foreground">Scan barcode barang dulu. Baris sebanyak stoknya akan muncul di sini.</p>
      )}
      <p className="text-12 text-muted-foreground">Jauhkan gulungan stiker & barang lain yang sudah bertag dari reader saat menyapu, supaya tidak ikut terbaca.</p>
    </div>
  );
}
