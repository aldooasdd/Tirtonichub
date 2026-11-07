"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Loader2, Plus, Sparkles, Trash2, XCircle } from "lucide-react";
import { brandSearch, catInfo, catRecommend, catSearch, checkProduct, saveProduct, uploadMedia } from "@/server/actions/channel-product";
import type { Attribute, Brand, Category, CategoryRules, ListingCheck, ShipTemplate } from "@/server/marketplace/tiktok-product";
import type { DraftCert, DraftVariant, Img, ProductDraft } from "@/lib/product-draft";

const field = "h-9 w-full rounded-md border bg-background px-2 text-14";
const label = "text-12 font-medium text-muted-foreground";
const card = "space-y-3 rounded-lg border bg-card p-4";
const btn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-14 font-medium hover:bg-muted disabled:opacity-50";

type Uploaded = { id: string; uri: string; url: string; name: string };
async function send(file: File, kind: string): Promise<Uploaded> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const r = await uploadMedia(fd);
  if (!r.ok) throw new Error(r.message);
  return r.data!;
}

const emptyVariant = (): DraftVariant => ({ value: "", price: 0, stock: 0, sellerSku: "", image: null });

/** Form buat / edit produk Tokopedia. `initial.productId` ada = mode edit. */
export function ProductForm({ initial, brandName }: { initial: ProductDraft; brandName?: string | null }) {
  const router = useRouter();
  const edit = !!initial.productId;
  const [d, setD] = useState<ProductDraft>(initial);
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const [descDirty, setDescDirty] = useState(!edit);
  const [hasVariant, setHasVariant] = useState(!!initial.variantName);

  const [busy, start] = useTransition();
  const [uploading, setUploading] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState<{ attributes: Attribute[]; rules: CategoryRules } | null>(null);
  const [cats, setCats] = useState<Category[] | null>(null);
  const [catQ, setCatQ] = useState("");
  const [brandQ, setBrandQ] = useState(brandName ?? "");
  const [brandList, setBrandList] = useState<Brand[] | null>(null);
  const [check, setCheck] = useState<{ check: ListingCheck; templates: ShipTemplate[] } | null>(null);
  const loadedCat = useRef("");

  // Muat atribut & aturan setiap kategori berubah.
  useEffect(() => {
    if (!d.categoryId || loadedCat.current === d.categoryId) return;
    loadedCat.current = d.categoryId;
    catInfo(d.categoryId).then((r) => {
      if (!r.ok) return setErr(r.message);
      setInfo(r.data!);
      const certs = r.data!.rules.certifications;
      setD((x) => ({
        ...x,
        certifications: certs.map((c) => x.certifications.find((y) => y.id === c.id) ?? { id: c.id, images: [], files: [] }),
      }));
    });
  }, [d.categoryId]);

  function pickCategory(c: Category) {
    setD((x) => ({ ...x, categoryId: c.id, categoryPath: c.path, categoryChanged: edit && c.id !== initial.categoryId, attributes: x.categoryId === c.id ? x.attributes : [] }));
    setInfo(null);
    setCats(null);
    setCheck(null);
  }

  async function upload(files: FileList | null, kind: string, onDone: (u: Uploaded) => void) {
    if (!files?.length) return;
    setErr("");
    setUploading(kind);
    try {
      for (const f of Array.from(files)) onDone(await send(f, kind));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload gagal.");
    } finally {
      setUploading("");
    }
  }

  const draft = (): ProductDraft => ({
    ...d,
    description: descDirty ? (d.description ?? "") : undefined,
    variantName: hasVariant ? d.variantName : "",
    variants: edit ? undefined : hasVariant ? d.variants : (d.variants ?? []).slice(0, 1),
  });

  function doCheck() {
    setErr("");
    start(async () => {
      const r = await checkProduct(draft());
      if (r.ok) setCheck(r.data!);
      else setErr(r.message);
    });
  }

  function doSave(saveMode: ProductDraft["saveMode"]) {
    setErr("");
    start(async () => {
      const r = await saveProduct({ ...draft(), saveMode });
      if (!r.ok) return setErr(r.message);
      const w = r.data.warnings.length ? `\n\nCatatan Tokopedia:\n- ${r.data.warnings.join("\n- ")}` : "";
      alert((edit ? "Perubahan tersimpan di Tokopedia." : saveMode === "AS_DRAFT" ? "Draft produk tersimpan di Tokopedia." : "Produk dibuat di Tokopedia.") + w + "\n\nData di Tirtonichub diperbarui beberapa menit lagi.");
      router.push(edit ? `/channel/produk/TOKOPEDIA/${r.data.productId}` : "/channel/produk");
      router.refresh();
    });
  }

  const attrs = (info?.attributes ?? []).filter((a) => !a.sales);
  const required = attrs.filter((a) => a.required);
  const optional = attrs.filter((a) => !a.required);
  const attrVal = (id: string) => d.attributes.find((a) => a.id === id)?.value ?? "";
  const setAttr = (id: string, value: string) => setD((x) => ({ ...x, attributes: [...x.attributes.filter((a) => a.id !== id), { id, value }] }));
  const variants = d.variants ?? [];
  const setVariant = (i: number, v: Partial<DraftVariant>) => set("variants", variants.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const setCert = (id: string, fn: (c: DraftCert) => DraftCert) => setD((x) => ({ ...x, certifications: x.certifications.map((c) => (c.id === id ? fn(c) : c)) }));

  const attrInput = (a: Attribute) => (
    <label key={a.id} className="block space-y-1">
      <span className={label}>
        {a.name}
        {a.required && <span className="text-destructive"> *</span>}
        {a.multiple && <span className="font-normal"> (pisahkan dengan koma)</span>}
      </span>
      {a.values.length && !a.custom && !a.multiple ? (
        <select value={attrVal(a.id)} onChange={(e) => setAttr(a.id, e.target.value)} className={field}>
          <option value="">Pilih</option>
          {a.values.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input value={attrVal(a.id)} onChange={(e) => setAttr(a.id, e.target.value)} list={`attr-${a.id}`} className={field} />
          {a.values.length > 0 && (
            <datalist id={`attr-${a.id}`}>
              {a.values.slice(0, 200).map((v) => (
                <option key={v.id} value={v.name} />
              ))}
            </datalist>
          )}
        </>
      )}
    </label>
  );

  return (
    <div className="space-y-4">
      {/* Foto & video */}
      <section className={card}>
        <h2 className="font-semibold">Foto produk</h2>
        <p className="text-12 text-muted-foreground">Maks 9 foto, JPG/PNG ≤5MB. Foto pertama jadi foto utama.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {d.images.map((im, i) => (
            <div key={im.uri} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace */}
              <img src={im.url} alt="" className={`aspect-square w-full rounded-md border object-cover ${i === 0 ? "ring-2 ring-primary" : ""}`} />
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                {i > 0 ? (
                  <button type="button" onClick={() => set("images", [im, ...d.images.filter((_, j) => j !== i)])} className="rounded bg-background/90 px-1 text-12">
                    Utama
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" aria-label="Hapus foto" onClick={() => set("images", d.images.filter((_, j) => j !== i))} className="rounded bg-background/90 p-0.5 text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          {d.images.length < 9 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-12 text-muted-foreground hover:bg-muted">
              {uploading === "MAIN_IMAGE" ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              Tambah
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = e.target.files;
                  void upload(files, "MAIN_IMAGE", (u) => setD((x) => ({ ...x, images: [...x.images, { uri: u.uri, url: u.url }].slice(0, 9) })));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-14">
          <span className={label}>Video (opsional, ≤25MB):</span>
          {d.video ? (
            <span className="flex items-center gap-2">
              {d.video.name}
              <button type="button" onClick={() => set("video", null)} className="text-destructive">
                Hapus
              </button>
            </span>
          ) : (
            <input type="file" accept="video/*" onChange={(e) => void upload(e.target.files, "FILE", (u) => set("video", { id: u.id, name: u.name }))} className="text-14" />
          )}
          {uploading === "FILE" && <Loader2 className="size-4 animate-spin" />}
        </div>
      </section>

      {/* Info */}
      <section className={card}>
        <h2 className="font-semibold">Info produk</h2>
        <label className="block space-y-1">
          <span className={label}>
            Judul <span className="font-normal">({d.title.trim().length}/255, minimal 25)</span>
          </span>
          <input value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={255} className={field} />
        </label>
        <label className="block space-y-1">
          <span className={label}>Deskripsi</span>
          <textarea
            value={d.description ?? ""}
            onChange={(e) => {
              setDescDirty(true);
              set("description", e.target.value);
            }}
            rows={8}
            className="w-full rounded-md border bg-background p-2 text-14"
          />
          {edit && !descDirty && <span className="text-12 text-muted-foreground">Deskripsi tidak dikirim kalau tidak diubah (format & gambar asli tetap).</span>}
        </label>
      </section>

      {/* Kategori & merek */}
      <section className={card}>
        <h2 className="font-semibold">Kategori & merek</h2>
        <p className="text-14">
          <span className="text-muted-foreground">Kategori: </span>
          <span className="font-medium">{d.categoryPath || "belum dipilih"}</span>
          {d.categoryChanged && <span className="ml-2 text-12 text-amber-600">kategori diganti: disimpan dengan edit penuh</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Cari kategori, mis. raket" className={`${field} max-w-xs`} />
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await catSearch(catQ);
                if (r.ok) setCats(r.data ?? []);
                else setErr(r.message);
              })
            }
          >
            Cari
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await catRecommend(d.title, d.description ?? "", d.images.map((i) => i.uri));
                if (!r.ok) return setErr(r.message);
                setCats(r.data ? [r.data] : []);
              })
            }
          >
            <Sparkles className="size-4" /> Rekomendasi dari judul
          </button>
        </div>
        {cats && (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-14">
            {cats.length === 0 && <li className="p-2 text-muted-foreground">Tidak ada kategori.</li>}
            {cats.map((c) => (
              <li key={c.id}>
                <button type="button" disabled={!c.allowed} onClick={() => pickCategory(c)} className="w-full p-2 text-left hover:bg-muted disabled:opacity-50">
                  {c.path || c.name}
                  {!c.allowed && <span className="ml-2 text-12 text-destructive">tidak diizinkan untuk toko</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1">
          <span className={label}>Merek (opsional)</span>
          <div className="flex flex-wrap gap-2">
            <input value={brandQ} onChange={(e) => setBrandQ(e.target.value)} placeholder="Nama merek" className={`${field} max-w-xs`} />
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await brandSearch(d.categoryId || null, brandQ);
                  if (r.ok) setBrandList(r.data ?? []);
                  else setErr(r.message);
                })
              }
            >
              Cari merek
            </button>
            {d.brandId && (
              <button type="button" className={btn} onClick={() => (set("brandId", null), setBrandQ(""))}>
                Tanpa merek
              </button>
            )}
          </div>
          {brandList && (
            <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-14">
              {brandList.length === 0 && <li className="p-2 text-muted-foreground">Merek tidak ditemukan.</li>}
              {brandList.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    disabled={!b.available}
                    onClick={() => (set("brandId", b.id), setBrandQ(b.name), setBrandList(null))}
                    className={`w-full p-2 text-left hover:bg-muted disabled:opacity-50 ${d.brandId === b.id ? "font-semibold" : ""}`}
                  >
                    {b.name}
                    {b.authorized && <span className="ml-2 text-12 text-emerald-600">resmi</span>}
                    {!b.available && <span className="ml-2 text-12 text-destructive">tidak tersedia di kategori ini</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Atribut */}
      {d.categoryId && (
        <section className={card}>
          <h2 className="font-semibold">Spesifikasi</h2>
          {!info ? (
            <p className="flex items-center gap-2 text-14 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Memuat atribut kategori…
            </p>
          ) : (
            <>
              {required.length > 0 ? <div className="grid gap-3 sm:grid-cols-2">{required.map(attrInput)}</div> : <p className="text-14 text-muted-foreground">Tidak ada atribut wajib.</p>}
              {optional.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-14 text-primary">Atribut lainnya ({optional.length})</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">{optional.map(attrInput)}</div>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {/* Varian & harga (buat baru) */}
      {!edit && (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Harga, stok & varian</h2>
            <label className="flex items-center gap-2 text-14">
              <input type="checkbox" checked={hasVariant} onChange={(e) => (setHasVariant(e.target.checked), !variants.length && set("variants", [emptyVariant()]))} />
              Punya varian
            </label>
          </div>
          {hasVariant && (
            <label className="block max-w-xs space-y-1">
              <span className={label}>Nama varian (mis. Warna, Ukuran)</span>
              <input value={d.variantName ?? ""} onChange={(e) => set("variantName", e.target.value)} list="sales-attrs" className={field} />
              <datalist id="sales-attrs">
                {(info?.attributes ?? [])
                  .filter((a) => a.sales)
                  .map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
              </datalist>
            </label>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-14">
              <thead>
                <tr className="text-left text-12 text-muted-foreground">
                  {hasVariant && <th className="p-1">Varian</th>}
                  {hasVariant && <th className="p-1">Foto</th>}
                  <th className="p-1">Harga (Rp)</th>
                  <th className="p-1">Stok</th>
                  <th className="p-1">SKU penjual</th>
                  {hasVariant && <th />}
                </tr>
              </thead>
              <tbody>
                {(hasVariant ? variants : variants.slice(0, 1)).map((v, i) => (
                  <tr key={i}>
                    {hasVariant && (
                      <td className="p-1">
                        <input value={v.value} onChange={(e) => setVariant(i, { value: e.target.value })} placeholder="mis. Merah" className={field} />
                      </td>
                    )}
                    {hasVariant && (
                      <td className="p-1">
                        {v.image ? (
                          <button type="button" onClick={() => setVariant(i, { image: null })} title="Hapus foto varian">
                            {/* eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace */}
                            <img src={v.image.url} alt="" className="size-9 rounded border object-cover" />
                          </button>
                        ) : (
                          <label className="flex size-9 cursor-pointer items-center justify-center rounded border border-dashed text-muted-foreground">
                            <ImagePlus className="size-4" />
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files, "ATTRIBUTE_IMAGE", (u) => setVariant(i, { image: { uri: u.uri, url: u.url } }))} />
                          </label>
                        )}
                      </td>
                    )}
                    <td className="p-1">
                      <input type="number" min={1} value={v.price || ""} onChange={(e) => setVariant(i, { price: Number(e.target.value) })} className={`${field} w-32`} />
                    </td>
                    <td className="p-1">
                      <input type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} className={`${field} w-24`} />
                    </td>
                    <td className="p-1">
                      <input value={v.sellerSku} onChange={(e) => setVariant(i, { sellerSku: e.target.value })} className={`${field} w-36`} />
                    </td>
                    {hasVariant && (
                      <td className="p-1">
                        {variants.length > 1 && (
                          <button type="button" aria-label="Hapus varian" onClick={() => set("variants", variants.filter((_, j) => j !== i))} className="p-1 text-destructive">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasVariant && (
            <button type="button" className={btn} onClick={() => set("variants", [...variants, emptyVariant()])}>
              <Plus className="size-4" /> Tambah varian
            </button>
          )}
        </section>
      )}

      {/* Pengiriman & lainnya */}
      <section className={card}>
        <h2 className="font-semibold">Pengiriman & lainnya</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ["weightKg", "Berat paket (kg) *"],
              ["length", `Panjang (cm)${info?.rules.dimensionRequired ? " *" : ""}`],
              ["width", `Lebar (cm)${info?.rules.dimensionRequired ? " *" : ""}`],
              ["height", `Tinggi (cm)${info?.rules.dimensionRequired ? " *" : ""}`],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="block space-y-1">
              <span className={label}>{l}</span>
              <input inputMode="decimal" value={d[k]} onChange={(e) => set(k, e.target.value)} className={field} />
            </label>
          ))}
          <label className="block space-y-1">
            <span className={label}>Minimal order (1–20)</span>
            <input type="number" min={1} max={20} value={d.minOrder ?? ""} onChange={(e) => set("minOrder", e.target.value ? Number(e.target.value) : null)} className={field} />
          </label>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-14">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!d.cod} disabled={info?.rules.codSupported === false} onChange={(e) => set("cod", e.target.checked)} />
            Bisa COD{info?.rules.codSupported === false && <span className="text-12 text-muted-foreground">(tidak didukung kategori ini)</span>}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!d.preOwned} onChange={(e) => set("preOwned", e.target.checked)} />
            Barang bekas <span className="text-12 text-muted-foreground">(hanya jika tayang di Tokopedia saja)</span>
          </label>
        </div>
        {!edit && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-14">
            <span className={label}>Tayang di:</span>
            {(["TOKOPEDIA", "TIKTOK_SHOP"] as const).map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={d.platforms.includes(p)}
                  onChange={(e) => set("platforms", e.target.checked ? [...d.platforms, p] : d.platforms.filter((x) => x !== p))}
                />
                {p === "TOKOPEDIA" ? "Tokopedia" : "TikTok Shop"}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Sertifikat & size chart */}
      {info && (info.rules.certifications.length > 0 || info.rules.sizeChartSupported) && (
        <section className={card}>
          <h2 className="font-semibold">Sertifikat & tabel ukuran</h2>
          {info.rules.certifications.map((rc) => {
            const c = d.certifications.find((x) => x.id === rc.id) ?? { id: rc.id, images: [], files: [] };
            return (
              <div key={rc.id} className="space-y-2 rounded-md border p-3">
                <p className="font-medium">
                  {rc.name}
                  {rc.required && <span className="text-destructive"> * wajib</span>}
                </p>
                {rc.details && <p className="whitespace-pre-line text-12 text-muted-foreground">{rc.details}</p>}
                <div className="flex flex-wrap items-center gap-2 text-14">
                  {c.images.map((im) => (
                    // eslint-disable-next-line @next/next/no-img-element -- dari CDN marketplace
                    <img key={im.uri} src={im.url} alt="" className="size-12 rounded border object-cover" />
                  ))}
                  {c.files.map((f) => (
                    <span key={f.id} className="rounded bg-muted px-2 py-1 text-12">
                      {f.name}
                    </span>
                  ))}
                  <label className={`${btn} cursor-pointer`}>
                    Foto
                    <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => void upload(e.target.files, "CERTIFICATION_IMAGE", (u) => setCert(rc.id, (x) => ({ ...x, images: [...x.images, { uri: u.uri, url: u.url }] })))} />
                  </label>
                  <label className={`${btn} cursor-pointer`}>
                    PDF
                    <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => void upload(e.target.files, "FILE", (u) => setCert(rc.id, (x) => ({ ...x, files: [...x.files, { id: u.id, name: u.name }] })))} />
                  </label>
                  {(c.images.length > 0 || c.files.length > 0) && (
                    <button type="button" className="text-12 text-destructive" onClick={() => setCert(rc.id, (x) => ({ ...x, images: [], files: [] }))}>
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {info.rules.sizeChartSupported && (
            <div className="flex flex-wrap items-center gap-2 text-14">
              <span className={label}>Tabel ukuran{info.rules.sizeChartRequired && <span className="text-destructive"> *</span>}</span>
              {d.sizeChart ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- dari CDN marketplace */}
                  <img src={d.sizeChart.url} alt="" className="size-12 rounded border object-cover" />
                  <button type="button" className="text-12 text-destructive" onClick={() => set("sizeChart", null)}>
                    Hapus
                  </button>
                </>
              ) : (
                <input type="file" accept="image/jpeg,image/png" onChange={(e) => void upload(e.target.files, "SIZE_CHART_IMAGE", (u) => set("sizeChart", { uri: u.uri, url: u.url } as Img))} />
              )}
            </div>
          )}
        </section>
      )}

      {/* Hasil cek */}
      {check && (
        <section className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            {check.check.pass ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-destructive" />}
            {check.check.pass ? "Lolos cek listing" : "Belum lolos cek listing"}
          </h2>
          {check.check.reasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-14 text-destructive">
              {check.check.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {check.check.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-14 text-amber-600">
              {check.check.warnings.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {!edit && check.templates.length > 0 && (
            <label className="block max-w-md space-y-1">
              <span className={label}>Template ongkir</span>
              <select value={d.shippingTemplateId ?? ""} onChange={(e) => set("shippingTemplateId", e.target.value || undefined)} className={field}>
                <option value="">Default toko</option>
                {check.templates.map((t) => (
                  <option key={t.id} value={t.id} disabled={!t.available}>
                    {t.name}
                    {t.isDefault ? " (default)" : ""}
                    {t.byPlatform ? " · kurir platform" : " · kirim sendiri"}
                    {!t.available ? ` · tidak tersedia${t.reasons[0] ? `: ${t.reasons[0]}` : ""}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {err && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{err}</p>}

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background/95 py-3">
        <button type="button" className={btn} disabled={busy || !!uploading} onClick={doCheck}>
          Cek kelayakan
        </button>
        {!edit && (
          <button type="button" className={btn} disabled={busy || !!uploading} onClick={() => doSave("AS_DRAFT")}>
            Simpan draft
          </button>
        )}
        <button type="button" disabled={busy || !!uploading} onClick={() => doSave("LISTING")} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {edit ? "Simpan perubahan" : "Simpan & tayangkan"}
        </button>
      </div>
    </div>
  );
}
