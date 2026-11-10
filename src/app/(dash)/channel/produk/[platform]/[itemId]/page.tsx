import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Pencil } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { productStatus } from "@/lib/channel-status";
import { DEMO, PLATFORM_LABEL } from "@/server/marketplace/sync";
import { ItemTable } from "@/components/channel/item-table";
import { loadProductGroupOf } from "@/server/marketplace/product-groups";
import { PRODUK_KE_MARKETPLACE } from "@/lib/flags";
import { ProductOps } from "@/components/channel/product-ops";
import { ProdukAdmin } from "@/components/channel/produk-admin";
import { ShopeeProductPanel } from "@/components/channel/shopee-product-panel";

const TAG: Record<string, string> = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600", WEBSITE: "bg-sky-500/15 text-sky-600" };

/** Deskripsi HTML marketplace → teks aman (tanpa render HTML mentah) + daftar gambar di dalamnya. */
function readDescription(html: string | null) {
  if (!html) return { text: "", images: [] as string[] };
  const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const text = html
    .replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, images };
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-12 font-medium text-muted-foreground">{label}</dt>
      <dd className="text-14">{children || "-"}</dd>
    </div>
  );
}

/** Detail Produk Master: semua data produk dari marketplace + varian (ubah stok/harga). */
export default async function ProdukDetailPage({ params }: { params: Promise<{ platform: string; itemId: string }> }) {
  await requireProduk();
  const { platform, itemId } = await params;
  const [items, d, group] = await Promise.all([
    prisma.marketplaceItem.findMany({ where: { platform, itemId }, orderBy: [{ variant: "asc" }, { name: "asc" }] }),
    prisma.marketplaceProduct.findUnique({ where: { platform_productId: { platform, productId: itemId } } }),
    loadProductGroupOf(platform, itemId),
  ]);
  const deleted = items.length > 0 && items.every((i) => i.deletedAt);
  const grp = group ?? (deleted ? await loadProductGroupOf(platform, itemId, true) : null);
  // Produk bernama sama di toko lain → harga & stok per marketplace di satu halaman.
  const listings = grp?.listings ?? [];
  const others = listings.filter((l) => !(l.platform === platform && l.itemId === itemId));
  const otherItems = others.length
    ? await prisma.marketplaceItem.findMany({ where: { OR: others.map((l) => ({ platform: l.platform, itemId: l.itemId })) }, orderBy: [{ variant: "asc" }, { name: "asc" }] })
    : [];
  if (items.length === 0 && !d) notFound();

  const images = (d?.images as string[] | undefined) ?? [];
  const attrs = (d?.attributes as { name: string; value: string }[] | undefined) ?? [];
  const video = d?.video as { url: string; cover: string | null } | null | undefined;
  const desc = readDescription(d?.description ?? null);
  const st = productStatus(d?.status);
  const toko = productStatus(d?.tokoStatus);
  const title = items.find((i) => i.localName)?.localName ?? d?.title ?? listings.find((l) => l.platform === platform && l.itemId === itemId)?.title ?? items[0]?.name ?? itemId;
  const stock = items.reduce((n, v) => n + v.stock, 0);

  return (
    <div className="space-y-5">
      <Link href="/channel/produk" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Produk Master
      </Link>

      <section className="grid gap-5 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,320px)_1fr]">
        {/* Galeri */}
        <div className="space-y-2">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
            <img src={images[0]} alt={title} className="aspect-square w-full rounded-lg border object-cover" />
          ) : (
            <div className="aspect-square w-full rounded-lg bg-muted" aria-hidden />
          )}
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.slice(1, 9).map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace */}
                  <img src={src} alt="" className="aspect-square w-full rounded-md border object-cover" />
                </a>
              ))}
            </div>
          )}
          {video?.url && (
            <video src={video.url} poster={video.cover ?? undefined} controls className="w-full rounded-lg border" preload="none">
              <track kind="captions" />
            </video>
          )}
        </div>

        {/* Info utama */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-12">
              <span className={`rounded px-1.5 py-0.5 font-medium ${TAG[platform] ?? "bg-muted"}`}>{PLATFORM_LABEL[platform as keyof typeof PLATFORM_LABEL] ?? platform}</span>
              {st && <span className={`font-medium ${st.tone}`}>{st.label}</span>}
              {toko && d?.tokoStatus !== d?.status && <span className={toko.tone}>Tokopedia: {toko.label}</span>}
              {items[0]?.shopId === DEMO && <span className="text-amber-600">contoh</span>}
            </div>
            {listings.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 text-12">
                <span className="text-muted-foreground">Dijual di:</span>
                {listings.map((l) => (
                  <Link
                    key={`${l.platform}:${l.itemId}`}
                    href={`/channel/produk/${l.platform}/${l.itemId}`}
                    className={`rounded px-1.5 py-0.5 font-medium ${TAG[l.platform] ?? "bg-muted"} ${l.platform === platform && l.itemId === itemId ? "ring-1 ring-current" : "hover:underline"}`}
                  >
                    {PLATFORM_LABEL[l.platform as keyof typeof PLATFORM_LABEL] ?? l.platform} · stok {l.stock}
                  </Link>
                ))}
              </div>
            )}
            <ProdukAdmin platform={platform} itemId={itemId} title={title} deleted={deleted} />
            {PRODUK_KE_MARKETPLACE && platform === "TOKOPEDIA" && items[0]?.shopId !== DEMO && (
              <Link href={`/channel/produk/${platform}/${itemId}/edit`} className="mr-4 inline-flex items-center gap-1 text-14 font-medium text-primary hover:underline">
                <Pencil className="size-3.5" /> Edit produk
              </Link>
            )}
            {d?.detailUrl && (
              <a href={d.detailUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-14 text-primary hover:underline">
                Lihat di marketplace <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Info label="Kategori">{d?.category}</Info>
            <Info label="Merek">{d?.brand}</Info>
            <Info label="ID produk">
              <span className="font-mono text-12">{itemId}</span>
            </Info>
            <Info label="Berat paket">{d?.weight}</Info>
            <Info label="Dimensi paket">{d?.dimensions}</Info>
            <Info label="Minimal order">{d?.minOrder ?? null}</Info>
            <Info label="COD">{d?.isCod == null ? null : d.isCod ? "Bisa" : "Tidak"}</Info>
            <Info label="Kondisi">{d?.preOwned == null ? null : d.preOwned ? "Bekas" : "Baru"}</Info>
            <Info label="Total stok">{stock}</Info>
            <Info label="Dibuat">{d?.createdAtMp ? fmtWIB(d.createdAtMp) : null}</Info>
            <Info label="Diubah">{d?.updatedAtMp ? fmtWIB(d.updatedAtMp) : null}</Info>
            <Info label="Disinkron">{d?.syncedAt ? fmtWIB(d.syncedAt) : null}</Info>
          </dl>

          {attrs.length > 0 && (
            <div>
              <h2 className="mb-2 text-16 font-semibold">Spesifikasi</h2>
              <dl className="grid gap-x-4 gap-y-2 rounded-md border p-3 sm:grid-cols-2">
                {attrs.map((a) => (
                  <div key={a.name} className="flex gap-2 text-14">
                    <dt className="w-40 shrink-0 text-muted-foreground">{a.name}</dt>
                    <dd>{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {platform === "TOKOPEDIA" && items[0]?.shopId !== DEMO && (
            <ProductOps
              productId={itemId}
              active={d?.status === "ACTIVATE"}
              variants={Object.fromEntries(items.map((i) => [i.modelId, i.variant ?? i.sku ?? i.name]))}
            />
          )}
          {!d && platform !== "WEBSITE" && <p className="rounded-md bg-amber-500/10 p-3 text-14 text-amber-700">Detail produk belum tersinkron. Sinkron detail berjalan bertahap tiap jam.</p>}
        </div>
      </section>

      {(() => {
        const sh = platform === "SHOPEE" ? { itemId, rows: items } : (() => {
          const l = others.find((x) => x.platform === "SHOPEE" && !x.demo);
          return l ? { itemId: l.itemId, rows: otherItems.filter((i) => i.platform === "SHOPEE" && i.itemId === l.itemId) } : null;
        })();
        return sh && sh.rows[0]?.shopId !== DEMO ? <ShopeeProductPanel itemId={sh.itemId} name={title} unlisted={sh.rows.every((r) => r.skuStatus === "DEACTIVATED")} /> : null;
      })()}

      {[{ platform, rows: items }, ...others.map((l) => ({ platform: l.platform, rows: otherItems.filter((i) => i.platform === l.platform && i.itemId === l.itemId) }))].map((sec, n) => (
      <section key={`${sec.platform}-${n}`} className="space-y-2">
        <h2 className="text-18 font-semibold">
          {listings.length > 1 ? (
            <>
              Harga & stok di <span className={`rounded px-1.5 py-0.5 text-14 ${TAG[sec.platform] ?? "bg-muted"}`}>{PLATFORM_LABEL[sec.platform as keyof typeof PLATFORM_LABEL] ?? sec.platform}</span> ({sec.rows.length} varian)
            </>
          ) : (
            <>Varian ({sec.rows.length})</>
          )}
        </h2>
        <ItemTable
          rows={sec.rows.map((i) => ({
            id: i.id,
            platform: i.platform,
            demo: i.shopId === DEMO,
            name: i.variant ?? i.name,
            sku: i.localSku ?? i.sku,
            price: i.price,
            stock: i.stock,
            image: i.image,
            inactive: i.skuStatus === "DEACTIVATED",
          }))}
        />
      </section>
      ))}

      {(desc.text || desc.images.length > 0) && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-18 font-semibold">Deskripsi</h2>
          {desc.text && <p className="text-14 whitespace-pre-line">{desc.text}</p>}
          {desc.images.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {desc.images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- gambar deskripsi dari CDN marketplace
                <img key={src} src={src} alt="" className="w-full rounded-md border" loading="lazy" />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
