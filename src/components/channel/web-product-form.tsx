"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { compressImage } from "@/lib/image";
import { simpanProdukWeb, uploadFotoWeb } from "@/server/actions/web-produk";
import type { WebFormKategori } from "@/server/marketplace/website";
import { useWebData } from "@/components/channel/web-data-fields";

const field = "h-9 w-full rounded-md border bg-background px-2 text-14";
const label = "text-12 font-medium text-muted-foreground";
const card = "space-y-3 rounded-lg border bg-card p-4";
const btn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-14 font-medium hover:bg-muted disabled:opacity-50";

type Varian = { warna: string; ukuran: string; harga: string; hargaDiskon: string; stok: string };
const varianKosong = (): Varian => ({ warna: "", ukuran: "", harga: "", hargaDiskon: "", stok: "" });
const angka = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));

function keBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

/** Form produk baru untuk tirtonic.com. Kirim ulang setelah tersimpan = update produk yang sama (ref tetap). */
export function WebProductForm({ kategori }: { kategori: WebFormKategori[] }) {
  const [ref] = useState(() => `HUB:${crypto.randomUUID()}`);
  const [kat, setKat] = useState(kategori[0]?.db ?? "");
  const k = useMemo(() => kategori.find((x) => x.db === kat), [kategori, kat]);
  const [nama, setNama] = useState("");
  const [brand, setBrand] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [berat, setBerat] = useState("");
  const [foto, setFoto] = useState<string[]>([]);
  const [pakaiVarian, setPakaiVarian] = useState(false);
  const [harga, setHarga] = useState("");
  const [hargaDiskon, setHargaDiskon] = useState("");
  const [stok, setStok] = useState("");
  const [varianLabel, setVarianLabel] = useState("");
  const [varian, setVarian] = useState<Varian[]>([varianKosong()]);
  const [ukuran, setUkuran] = useState("");

  const [uploading, setUploading] = useState(0);
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const data = useWebData(k);
  const [hasil, setHasil] = useState<{ url: string; created: boolean } | null>(null);

  const setV = (i: number, kk: keyof Varian, v: string) => setVarian((vs) => vs.map((x, j) => (j === i ? { ...x, [kk]: v } : x)));

  async function tambahFoto(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    const arr = [...files].slice(0, 10 - foto.length);
    setUploading((n) => n + arr.length);
    for (const f of arr) {
      try {
        const r = await uploadFotoWeb({ nama: f.name.replace(/\.\w+$/, ".jpg"), tipe: "image/jpeg", data: await keBase64(await compressImage(f, 1600, 0.82)) });
        if (r.ok) setFoto((x) => [...x, r.data]);
        else setErr(r.message);
      } catch {
        setErr(`Foto ${f.name} gagal dibaca.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function simpan() {
    setErr("");
    const vs = varian.filter((v) => v.warna.trim());
    if (!nama.trim()) return setErr("Nama produk wajib diisi.");
    if (!foto.length) return setErr("Tambahkan minimal 1 foto.");
    if (pakaiVarian && !vs.length) return setErr("Isi minimal 1 varian.");
    if (!pakaiVarian && !(angka(harga)! > 0)) return setErr("Harga wajib diisi.");
    start(async () => {
      const r = await simpanProdukWeb({
        ref,
        nama,
        kategori: kat,
        brand: brand || null,
        harga: angka(harga) ?? 0,
        hargaDiskon: angka(hargaDiskon),
        stok: angka(stok),
        berat: angka(berat),
        deskripsi: deskripsi || null,
        gambar: foto,
        ukuran: kat === "Sepatu Tenis" ? ukuran.split(",").map((x) => x.trim()).filter(Boolean) : [],
        varianLabel: pakaiVarian ? varianLabel || null : null,
        variants: pakaiVarian ? vs.map((v) => ({ warna: v.warna, ukuran: v.ukuran, harga: angka(v.harga) ?? 0, hargaDiskon: angka(v.hargaDiskon), stok: angka(v.stok) ?? 0 })) : [],
        ...data.payload(),
      });
      if (r.ok) setHasil(r.data);
      else setErr(r.message);
    });
  }

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-16 font-semibold">Info produk</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={label}>Kategori</span>
            <select className={field} value={kat} onChange={(e) => { setKat(e.target.value); data.reset(); }}>
              {kategori.map((x) => <option key={x.db} value={x.db}>{x.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className={label}>Brand</span>
            <input className={field} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Wilson" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className={label}>Nama produk</span>
            <input className={field} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Raket Tenis Wilson Blade 98 / 305g Tennis Racket" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className={label}>Deskripsi</span>
            <textarea className={`${field} h-32 py-2`} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={label}>Berat kirim (gram)</span>
            <input className={field} inputMode="numeric" value={berat} onChange={(e) => setBerat(e.target.value)} placeholder={kat === "Sepatu Tenis" ? "2000" : "500"} />
          </label>
          {kat === "Sepatu Tenis" && (
            <label className="space-y-1">
              <span className={label}>Ukuran tersedia (pisah koma)</span>
              <input className={field} value={ukuran} onChange={(e) => setUkuran(e.target.value)} placeholder="40, 41, 42, 43" />
            </label>
          )}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-16 font-semibold">Foto</h2>
        <p className="text-12 text-muted-foreground">Foto pertama jadi foto utama di kartu produk. Maksimal 10.</p>
        <div className="flex flex-wrap gap-2">
          {foto.map((u, i) => (
            <div key={u} className="relative size-24 overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
              <button type="button" aria-label="Hapus foto" onClick={() => setFoto((x) => x.filter((y) => y !== u))} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="size-3.5" /></button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1 text-[10px]">Utama</span>}
            </div>
          ))}
          {foto.length < 10 && (
            <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-12 text-muted-foreground hover:bg-muted">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              {uploading ? `${uploading} upload` : "Tambah"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void tambahFoto(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-16 font-semibold">Harga & stok</h2>
          <label className="flex items-center gap-2 text-14">
            <input type="checkbox" checked={pakaiVarian} onChange={(e) => setPakaiVarian(e.target.checked)} /> Punya varian
          </label>
        </div>
        {!pakaiVarian ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1"><span className={label}>Harga normal</span><input className={field} inputMode="numeric" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="2499000" /></label>
            <label className="space-y-1"><span className={label}>Harga diskon (opsional)</span><input className={field} inputMode="numeric" value={hargaDiskon} onChange={(e) => setHargaDiskon(e.target.value)} /></label>
            <label className="space-y-1"><span className={label}>Stok (kosong = tak terbatas)</span><input className={field} inputMode="numeric" value={stok} onChange={(e) => setStok(e.target.value)} /></label>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block max-w-xs space-y-1">
              <span className={label}>Nama pilihan varian</span>
              <input className={field} value={varianLabel} onChange={(e) => setVarianLabel(e.target.value)} placeholder={kat === "Raket Tenis" ? "Grip" : "Warna"} />
            </label>
            <div className="space-y-2">
              {varian.map((v, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_0.7fr_auto] sm:border-0 sm:p-0">
                  <input className={field} value={v.warna} onChange={(e) => setV(i, "warna", e.target.value)} placeholder={kat === "Raket Tenis" ? "G2" : "Hitam"} aria-label="Varian" />
                  <input className={field} value={v.ukuran} onChange={(e) => setV(i, "ukuran", e.target.value)} placeholder="Ukuran (opsional)" aria-label="Ukuran" />
                  <input className={field} inputMode="numeric" value={v.harga} onChange={(e) => setV(i, "harga", e.target.value)} placeholder="Harga" aria-label="Harga" />
                  <input className={field} inputMode="numeric" value={v.hargaDiskon} onChange={(e) => setV(i, "hargaDiskon", e.target.value)} placeholder="Diskon" aria-label="Harga diskon" />
                  <input className={field} inputMode="numeric" value={v.stok} onChange={(e) => setV(i, "stok", e.target.value)} placeholder="Stok" aria-label="Stok" />
                  <button type="button" className={btn} aria-label="Hapus varian" onClick={() => setVarian((vs) => vs.filter((_, j) => j !== i))} disabled={varian.length === 1}><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" className={btn} onClick={() => setVarian((vs) => [...vs, { ...varianKosong(), harga: vs.at(-1)?.harga ?? "", hargaDiskon: vs.at(-1)?.hargaDiskon ?? "" }])}><Plus className="size-4" /> Tambah varian</button>
          </div>
        )}
      </section>

      {data.ui}

      {err && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{err}</p>}
      {hasil && (
        <p className="flex flex-wrap items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-14 text-emerald-700">
          {hasil.created ? "Produk tayang di tirtonic.com." : "Perubahan tersimpan."}
          <a href={hasil.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">Lihat produk <ExternalLink className="size-3.5" /></a>
        </p>
      )}
      <button type="button" onClick={simpan} disabled={busy || uploading > 0} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-14 font-medium text-primary-foreground disabled:opacity-50">
        {busy && <Loader2 className="size-4 animate-spin" />} {hasil ? "Simpan perubahan" : "Tayangkan di tirtonic.com"}
      </button>
    </div>
  );
}
