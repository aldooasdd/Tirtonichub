import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { PRODUK_KE_MARKETPLACE } from "@/lib/flags";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import { listingPrerequisites } from "@/server/marketplace/tiktok-product";
import { ProductForm } from "@/components/channel/product-form";
import { websiteForm, websiteReady, type WebFormKategori } from "@/server/marketplace/website";
import { prisma } from "@/server/db";
import { tokoGudang } from "@/server/pos-catalog";
import { DraftRfid } from "@/components/channel/draft-rfid";
import { HapusDraft } from "@/components/channel/hapus-draft";
import type { DraftData } from "@/lib/product-draft";

const CHECK_LABEL: Record<string, string> = {
  SHOP_STATUS: "Status toko",
  SHOP_TAX: "Data pajak toko",
  PICKUP_WAREHOUSE: "Gudang pengambilan",
  RETURN_WAREHOUSE: "Gudang retur",
  DELIVERY_OPTION: "Opsi pengiriman",
  SHIPPING_TEMPLATE: "Template ongkir",
};

/** Tambah produk baru ke Tokopedia (Create Product). Syarat toko dicek dulu (Check Listing Prerequisites). */
export default async function TambahProdukPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  await requireProduk();
  const draftId = (await searchParams).draft;
  const row = draftId ? await prisma.draftProduk.findUnique({ where: { id: draftId } }) : null;
  if (draftId && !row) redirect("/channel/produk/draft");
  const saved = row ? { id: row.id, data: row.data as unknown as DraftData } : undefined;
  // RFID per varian yang sudah ada SKU (SKU dari draft tersimpan)
  const vs = (saved?.data.d.variants ?? []).filter((v) => v.sellerSku.trim());
  const [toko, tagCount] = saved
    ? await Promise.all([tokoGudang(), prisma.rfidTag.groupBy({ by: ["sku"], where: { sku: { in: vs.map((v) => v.sellerSku.trim()), mode: "insensitive" } }, _count: true })])
    : [[], []];
  const varian = vs.map((v) => ({
    label: [v.value, v.value2].filter(Boolean).join(" / ") || "Tanpa varian",
    sku: v.sellerSku.trim(),
    tags: tagCount.find((t) => t.sku.toLowerCase() === v.sellerSku.trim().toLowerCase())?._count ?? 0,
  }));
  if (!PRODUK_KE_MARKETPLACE) redirect("/channel/produk");
  const shop = await activeShop("TOKOPEDIA");
  const real = !!shop && shop.shopId !== DEMO;
  let checks: { item: string; failed: boolean; reasons: string[] }[] = [];
  let checkErr = "";
  if (real) {
    try {
      const s = await fresh(shop);
      checks = await listingPrerequisites({ token: s.accessToken, cipher: s.cipher ?? "" });
    } catch (e) {
      checkErr = e instanceof Error ? e.message : "Gagal cek syarat toko.";
    }
  }
  const failed = checks.filter((c) => c.failed);
  // pilihan tujuan tirtonic.com: kategori & field filter dari web (gagal = pilihan web disembunyikan)
  const webKategori: WebFormKategori[] = websiteReady() ? await websiteForm().catch(() => []) : [];

  return (
    <div className="space-y-5">
      <Link href={saved ? "/channel/produk/draft" : "/channel/produk"} className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {saved ? "Draft produk" : "Produk Master"}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">{saved ? `Draft: ${row!.title}` : "Tambah Produk"}</h1>
          <p className="text-14 text-muted-foreground">
            {saved
              ? "QC: isi SKU tiap varian, Simpan draft, lalu pasang RFID di bawah. Simpan & tayangkan = tayang ke toko yang dicentang, draft hilang."
              : "Simpan draft = tersimpan di Tirtonichub untuk semua toko (QC isi SKU & RFID). Simpan & tayangkan = langsung tayang."}
          </p>
        </div>
        {saved && <HapusDraft id={saved.id} />}
      </div>
      {saved && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-16 font-semibold">RFID</h2>
          <DraftRfid varian={varian} cabang={toko.map((t) => ({ id: t.id, label: t.label }))} />
        </section>
      )}
      {!real && <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sambungkan toko Tokopedia asli dulu di Kelola Pesanan.</p>}
      {checkErr && <p className="rounded-md bg-amber-500/10 p-3 text-14 text-amber-700">Syarat toko belum bisa dicek: {checkErr}</p>}
      {failed.length > 0 && (
        <div className="space-y-1 rounded-md bg-destructive/10 p-3 text-14 text-destructive">
          <p className="font-semibold">Toko belum memenuhi syarat untuk menayangkan produk:</p>
          <ul className="list-disc pl-5">
            {failed.map((c) => (
              <li key={c.item}>
                {CHECK_LABEL[c.item] ?? c.item}: {c.reasons.join(" ") || "belum lengkap"}
              </li>
            ))}
          </ul>
        </div>
      )}
      {real && checks.length > 0 && failed.length === 0 && <p className="text-14 text-emerald-600">Syarat toko lengkap: siap menayangkan produk.</p>}
      {real && (
        <ProductForm
          key={saved?.id}
          webKategori={webKategori}
          draft={saved}
          initial={saved?.data.d ?? {
            title: "",
            description: "",
            images: [],
            categoryId: "",
            attributes: [],
            variantName: "",
            variants: [{ value: "", price: 0, stock: 0, sellerSku: "", image: null }],
            weightKg: "",
            length: "",
            width: "",
            height: "",
            minOrder: null,
            cod: false,
            preOwned: false,
            platforms: ["TOKOPEDIA", "TIKTOK_SHOP"],
            certifications: [],
            saveMode: "LISTING",
          }}
        />
      )}
    </div>
  );
}
