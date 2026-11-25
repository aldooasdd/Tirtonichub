"use client";

import { useEffect, useRef, useState } from "react";
import { Boxes, Pencil, Save, ScanLine, X } from "lucide-react";
import { cariBarang, gantiSku, lookupSku, ownersOf, pairTags, pemakaiSku, simpanStok, type Barang, type SkuInfo } from "@/server/actions/rfid";

// EPC stiker UHF = hex 24–32 huruf; barcode barang (EAN/UPC/SKU) lebih pendek → dianggap SKU.
const isTag = (v: string) => /^[0-9A-F]{24,32}$/i.test(v);
const MAX_ROWS = 300; // batas baris kosong; 999 = stok web "tak terbatas"
type Draft = { epc: string; branchId: string; owner: string | null; move: boolean }; // owner = nama barang lain pemilik tag
const namaBarang = (s: SkuInfo) => (s.name ? (s.variant ? `${s.name} · ${s.variant}` : s.name) : `SKU ${s.sku}`);
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

/** Stok per cabang → marketplace. Tanpa <form>: Enter dari reader tidak boleh menyimpan. */
function EditStok({ info, disabled, onSave, onClose }: { info: SkuInfo; disabled: boolean; onSave: (c: { branchId: string; stock: number }[]) => void; onClose: () => void }) {
  const cabang = info.cabang.filter((s) => s.bisa).map((s) => ({ branchId: s.id, label: s.label, stock: s.stock ?? 0 }));
  const belum = info.cabang.filter((s) => !s.bisa);
  const [val, setVal] = useState<Record<string, string>>(() => Object.fromEntries(cabang.map((s) => [s.branchId, String(s.stock)])));
  const [pakai, setPakai] = useState<string[] | null>(null);
  useEffect(() => {
    let on = true;
    pemakaiSku(info.sku).then((r) => on && setPakai(r)).catch(() => {});
    return () => { on = false; };
  }, [info.sku]);
  const ubah = cabang.filter((s) => val[s.branchId!] !== String(s.stock));
  const salah = ubah.some((s) => !/^\d{1,4}$/.test(val[s.branchId!]));
  return (
    <div className="space-y-3 border-t bg-muted/40 p-3 text-14" onClick={(e) => e.stopPropagation()}>
      {cabang.length ? (
        <div className="flex flex-wrap gap-3">
          {cabang.map((s) => (
            <label key={s.branchId} className="flex flex-col gap-1 text-12 text-muted-foreground">
              {s.label} (sekarang {s.stock})
              <input inputMode="numeric" value={val[s.branchId!]} onChange={(e) => setVal((v) => ({ ...v, [s.branchId!]: e.target.value.trim() }))} className="h-10 w-32 rounded-md border bg-background px-3 text-14 text-foreground" />
            </label>
          ))}
        </div>
      ) : (
        <p>Belum ada cabang yang punya gudang Shopee/Tokopedia.</p>
      )}
      {belum.length > 0 && <p className="text-12 text-amber-600">{belum.map((s) => s.label).join(", ")} belum punya gudang. Pilih gudangnya di Tirtonic POS → Per cabang.</p>}
      {salah && <p className="text-12 text-red-600">Stok harus angka 0–9999.</p>}
      {cabang.length > 0 && (
        <div className="text-12 text-muted-foreground">
          Langsung mengubah stok di Shopee & Tokopedia untuk:
          <ul className="list-disc pl-5">{pakai ? pakai.map((x, i) => <li key={i}>{x}</li>) : <li>Memuat…</li>}</ul>
        </div>
      )}
      <div className="flex gap-2">
        {cabang.length > 0 && (
          <button type="button" disabled={disabled || !pakai || !ubah.length || salah} onClick={() => onSave(ubah.map((s) => ({ branchId: s.branchId!, stock: Number(val[s.branchId!]) })))} className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-40">
            {disabled ? "Memproses…" : "Simpan stok"}
          </button>
        )}
        <button type="button" onClick={onClose} className="h-9 rounded-md border px-4">Tutup</button>
      </div>
    </div>
  );
}

// Tanpa confirm(): reader mengetik Enter, dialog bisa ter-OK sendiri.
export function PasangTag() {
  const [sku, setSku] = useState<SkuInfo | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [next, setNext] = useState<string | null>(null); // barcode baru di-scan saat tag belum disimpan
  const [edit, setEdit] = useState(false);
  const [editStok, setEditStok] = useState(false);
  const [cabang, setCabang] = useState<string | null>(null); // cabang tujuan scan
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const skuRef = useRef<SkuInfo | null>(null);
  const draftRef = useRef<Draft[]>([]);
  const nextRef = useRef<string | null>(null);
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cabangRef = useRef<string | null>(null);
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
    setEditStok(false);
    putSku(await lookupSku(code));
    setMsg(null);
  }

  // Kode tag dikumpulkan sebentar lalu dicek pemiliknya sekaligus.
  function flush() {
    clearTimeout(timer.current);
    const list = [...new Set(pending.current)];
    pending.current = [];
    if (!list.length) return;
    const tujuan = cabangRef.current; // cabang saat tag terbaca
    enqueue(async () => {
      if (nextRef.current) return setMsg({ ok: false, text: `${list.length} tag tidak dimasukkan. Simpan atau buang dulu tag barang sebelumnya.` });
      const cur = skuRef.current;
      const owner = new Map((await ownersOf(list)).map((o) => [o.epc, o.name]));
      if (!cur) {
        const n = new Map<string, number>();
        for (const e of list) n.set(owner.get(e) ?? "", (n.get(owner.get(e) ?? "") ?? 0) + 1);
        return setMsg({ ok: true, text: `Belum pilih barang. Tag terbaca: ${[...n].map(([s, c]) => (s ? `${c} milik ${s}` : `${c} belum terpasang`)).join(" · ")}` });
      }
      const di = cur.cabang.find((c) => c.id === tujuan);
      if (!di) return setMsg({ ok: false, text: `${list.length} tag terbaca, tapi cabang belum dipilih. Klik "Scan ke sini" di cabangnya, lalu sapu lagi.` });
      // Tag tersimpan barang ini: cabang lain → perlu "Pindahkan"; belum ada cabang → langsung diisi.
      const simpan = new Map(cur.tagList.map((t) => [t.epc, t.branchId]));
      for (const e of list) {
        if (!simpan.has(e)) continue;
        const asal = cur.cabang.find((c) => c.id === simpan.get(e));
        if (asal) owner.set(e, `${namaBarang(cur)} (${asal.label})`);
        else owner.delete(e);
      }
      const have = new Set([...cur.tagList.filter((t) => t.branchId === tujuan).map((t) => t.epc), ...draftRef.current.map((d) => d.epc)]);
      const baru = list.filter((e) => !have.has(e));
      putDrafts([...draftRef.current, ...baru.map((epc) => ({ epc, branchId: di.id, owner: owner.get(epc) ?? null, move: false }))]);
      const milik = new Map<string, number>(); // tag baru terbaca, tapi sudah terpasang di barang lain
      for (const e of baru) { const n = owner.get(e); if (n) milik.set(n, (milik.get(n) ?? 0) + 1); }
      const simpanan = list.filter((e) => simpan.get(e) === di.id).length;
      const bebas = baru.filter((e) => !owner.has(e)).length;
      const ulang = list.length - baru.length - simpanan;
      setMsg({
        ok: !milik.size,
        text: [
          bebas && `${bebas} tag masuk ke ${di.label}, belum disimpan`,
          simpanan && `${simpanan} tag sudah terpasang di ${namaBarang(cur)} (${di.label})`,
          ulang && `${ulang} tag sudah terbaca, belum disimpan`,
          ...[...milik].map(([n, c]) => `${c} tag sudah terpasang di ${n}`),
        ].filter(Boolean).join(" · "),
      });
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
    if (!list.some(siap)) return;
    const other = new Map<string, string>(); // keburu dipasang orang lain
    let tagList = cur.tagList;
    for (const b of new Set(list.map((d) => d.branchId))) {
      const punya = list.filter((d) => d.branchId === b);
      const baru = punya.filter((d) => !d.owner).map((d) => d.epc);
      const pindah = punya.filter((d) => d.owner && d.move).map((d) => d.epc);
      if (baru.length) {
        const r = await pairTags(baru, cur.sku, b);
        for (const o of r.other) other.set(o.epc, o.name);
        tagList = r.tagList;
      }
      if (pindah.length) tagList = (await pairTags(pindah, cur.sku, b, true)).tagList;
    }
    const saved = new Map(tagList.map((t) => [t.epc, t.branchId]));
    const rest = list.filter((d) => saved.get(d.epc) !== d.branchId).map((d) => ({ ...d, owner: other.get(d.epc) ?? d.owner }));
    putDrafts(rest);
    putSku({ ...cur, tagList });
    setMsg({ ok: !rest.length, text: `${list.length - rest.length} tag tersimpan di ${namaBarang(cur)}.${rest.length ? ` ${rest.length} milik barang/cabang lain belum disimpan.` : ""}` });
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
        putDrafts(draftRef.current.filter((d) => !info.tagList.some((t) => t.epc === d.epc && t.branchId === d.branchId)));
      }
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) setEdit(false);
      if (r.ok) input.current?.focus();
    });
  };
  const ubahStok = (c: { branchId: string; stock: number }[]) => {
    const s = skuRef.current?.sku;
    if (!s) return;
    enqueue(async () => {
      const r = await simpanStok(s, c);
      setMsg({ ok: r.ok, text: r.message });
      putSku(await lookupSku(s)); // baris mengikuti stok baru
      if (r.ok) {
        setEditStok(false);
        input.current?.focus();
      }
    });
  };
  const hapus = (epc: string) => putDrafts(draftRef.current.filter((d) => d.epc !== epc));
  const pindahkan = (epc: string) => putDrafts(draftRef.current.map((d) => (d.epc === epc ? { ...d, move: !d.move } : d)));

  const pilihCabang = (id: string) => { flush(); cabangRef.current = id; setCabang(id); input.current?.focus(); };

  const draftEpc = new Set(drafts.map((d) => d.epc));
  const isi = new Set([...(sku?.tagList.map((t) => t.epc) ?? []), ...draftEpc]).size;
  const stok = sku?.stock != null && sku.stock < 999 ? sku.stock : null;
  const nSiap = drafts.filter(siap).length;
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-14 font-medium disabled:opacity-40";
  const label = (id: string) => sku?.cabang.find((c) => c.id === id)?.label ?? "";
  // 1 bagian per cabang + tag lama yang belum ada cabangnya.
  const bagian = sku
    ? [
        ...sku.cabang.map((c) => ({
          id: c.id as string | null, label: c.label, stok: c.stock != null && c.stock < 999 ? c.stock : null,
          saved: sku.tagList.filter((t) => t.branchId === c.id && !draftEpc.has(t.epc)).map((t) => t.epc),
          baru: drafts.filter((d) => d.branchId === c.id),
        })),
        {
          id: null as string | null, label: "Belum ada cabang", stok: null as number | null,
          saved: sku.tagList.filter((t) => !draftEpc.has(t.epc) && !sku.cabang.some((c) => c.id === t.branchId)).map((t) => t.epc),
          baru: [] as Draft[],
        },
      ].filter((b) => b.id || b.saved.length)
    : [];

  return (
    <div className="space-y-4" onClick={() => input.current?.focus()}>
      <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border bg-card p-3">
        <ScanLine className="size-5 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={sku ? "Sapu stiker barang ini… (scan barcode lain = ganti barang)" : "Scan barcode SKU barang / ketik SKU lalu Enter"}
          aria-label="Scan"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-14"
        />
        {busy > 0 && <span className="text-12 text-muted-foreground">Memproses…</span>}
      </form>

      {next && (
        <div className="space-y-2 rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-14">
          <p>Barcode <b className="font-mono">{next}</b> terbaca, tapi {drafts.length} tag untuk {sku && namaBarang(sku)} belum disimpan.</p>
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
              <div className="flex shrink-0 flex-wrap justify-end gap-2 self-start">
              <button type="button" disabled={busy > 0} onClick={(e) => { e.stopPropagation(); setEditStok(false); setEdit(true); }} className={`${btn} border`}>
                <Pencil className="size-4" /> Edit barang
              </button>
              <button type="button" disabled={busy > 0} onClick={(e) => { e.stopPropagation(); setEditStok(true); }} className={`${btn} border`}>
                <Boxes className="size-4" /> Edit stok
              </button>
              </div>
            )}
          </div>

          {(!sku.name || edit) && <PilihBarang key={`${sku.sku}|${edit}`} sku={sku.sku} edit={edit} disabled={busy > 0} onPick={pilih} onClose={() => setEdit(false)} />}

          {editStok && <EditStok key={sku.sku} info={sku} disabled={busy > 0} onSave={ubahStok} onClose={() => setEditStok(false)} />}

          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-y bg-card px-3 py-2 text-14">
            <span>Terisi <b>{isi}</b>{stok != null ? ` dari ${stok} stok` : ""} · {sku.tagList.length} tersimpan{drafts.length ? ` · ${drafts.length} belum disimpan` : ""}</span>
            <span className="flex gap-2">
              {drafts.length > 0 && <button type="button" disabled={busy > 0} onClick={() => putDrafts([])} className={`${btn} border`}>Kosongkan</button>}
              <button type="button" disabled={busy > 0 || nSiap === 0} onClick={klikSimpan} className={`${btn} bg-primary text-primary-foreground`}>
                <Save className="size-4" /> Simpan{nSiap ? ` (${nSiap})` : ""}
              </button>
            </span>
          </div>

          {bagian.map((b) => {
            const n = b.saved.length + b.baru.length;
            const kosong = Math.max(0, Math.min(b.stok ?? 0, MAX_ROWS) - n);
            const aktif = b.id != null && b.id === cabang;
            const lebih = (i: number) => (b.stok != null && i >= b.stok ? <span className="text-amber-600"> · lebih dari stok</span> : null);
            return (
              <section key={b.id ?? "-"} className="border-t first-of-type:border-t-0">
                <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${aktif ? "bg-primary/10" : "bg-muted/40"}`}>
                  <h2 className="text-14"><b>{b.label}</b> <span className="text-muted-foreground">· {n} tag{b.stok != null ? ` dari ${b.stok} stok` : ""}</span></h2>
                  {b.id ? (
                    <button type="button" aria-pressed={aktif} onClick={() => pilihCabang(b.id!)} className={`${btn} ${aktif ? "bg-primary text-primary-foreground" : "border"}`}>
                      <ScanLine className="size-4" /> {aktif ? "Scan masuk ke sini" : "Scan ke sini"}
                    </button>
                  ) : (
                    <span className="text-12 text-muted-foreground">Pilih cabang, lalu sapu ulang stikernya.</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-14">
                    <thead>
                      <tr className="text-left text-12 text-muted-foreground"><th className="w-12 px-3 py-2">No</th><th className="px-3 py-2">ID Tag</th><th className="px-3 py-2">Status</th><th className="w-10" /></tr>
                    </thead>
                    <tbody>
                      {b.saved.map((e, i) => (
                        <tr key={e} className="border-t">
                          <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-12">{e}</td>
                          <td className="px-3 py-2 text-emerald-600">Tersimpan{lebih(i)}</td>
                          <td />
                        </tr>
                      ))}
                      {b.baru.map((d, j) => {
                        const i = b.saved.length + j;
                        return (
                          <tr key={d.epc} className="border-t bg-amber-500/5">
                            <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-12">{d.epc}</td>
                            <td className="px-3 py-2">
                              {d.owner ? (
                                <>
                                  <span className="text-red-600">Milik {d.owner}</span>{" "}
                                  <button type="button" onClick={() => pindahkan(d.epc)} className="underline">{d.move ? "Batal pindah" : `Pindahkan ke ${label(d.branchId)}`}</button>
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
                          <td className="px-3 py-2 tabular-nums">{n + j + 1}</td>
                          <td className="px-3 py-2"><span className="block h-6 rounded border border-dashed" /></td>
                          <td className="px-3 py-2 text-12">Menunggu scan</td>
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {b.stok != null && b.stok > MAX_ROWS && <p className="border-t px-3 py-2 text-12 text-muted-foreground">Baris kosong ditampilkan sampai {MAX_ROWS}; baris berikutnya muncul saat tag terbaca.</p>}
                {b.id && n === 0 && b.stok == null && <p className="border-t px-3 py-2 text-12 text-muted-foreground">Stok tidak diketahui. Baris muncul saat tag terbaca.</p>}
                {b.id && n === 0 && b.stok === 0 && <p className="border-t px-3 py-2 text-12 text-muted-foreground">Stok sistem 0. Tag tetap bisa di-scan.</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-14 text-muted-foreground">Scan barcode barang dulu. Baris sebanyak stoknya akan muncul di sini.</p>
      )}
      <p className="text-12 text-muted-foreground">Jauhkan gulungan stiker & barang lain yang sudah bertag dari reader saat menyapu, supaya tidak ikut terbaca.</p>
    </div>
  );
}
