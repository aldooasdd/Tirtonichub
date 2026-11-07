import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import { productRaw } from "@/server/marketplace/tiktok-product";
import { ProductForm } from "@/components/channel/product-form";
import { htmlToText, type ProductDraft } from "@/lib/product-draft";

const kg = (w?: { value?: string; unit?: string }) => {
  const v = Number(w?.value);
  if (!(v > 0)) return "";
  return String(w?.unit === "GRAM" ? v / 1000 : w?.unit === "POUND" ? Math.round(v * 453.592) / 1000 : v);
};

/** Edit produk Tokopedia: data diambil langsung dari Tokopedia (Get Product), disimpan lewat Partial Edit / Edit Product. */
export default async function EditProdukPage({ params }: { params: Promise<{ platform: string; itemId: string }> }) {
  await requireChannel();
  const { platform, itemId } = await params;
  if (platform !== "TOKOPEDIA") notFound();
  const shop = await activeShop("TOKOPEDIA");
  const back = (
    <Link href={`/channel/produk/${platform}/${itemId}`} className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" /> Detail produk
    </Link>
  );
  if (!shop || shop.shopId === DEMO)
    return (
      <div className="space-y-5">
        {back}
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sambungkan toko Tokopedia asli untuk mengedit produk.</p>
      </div>
    );

  let raw;
  try {
    const s = await fresh(shop);
    raw = await productRaw({ token: s.accessToken, cipher: s.cipher ?? "" }, itemId);
  } catch (e) {
    return (
      <div className="space-y-5">
        {back}
        <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">Gagal mengambil produk dari Tokopedia: {e instanceof Error ? e.message : "error"}</p>
      </div>
    );
  }

  const leaf = raw.category_chains?.find((c) => c.is_leaf) ?? raw.category_chains?.at(-1);
  const dm = raw.package_dimensions;
  const initial: ProductDraft = {
    productId: raw.id,
    title: raw.title,
    description: htmlToText(raw.description),
    images: (raw.main_images ?? []).map((i) => ({ uri: i.uri, url: i.urls?.[0] ?? "" })),
    categoryId: leaf?.id ?? "",
    categoryPath: (raw.category_chains ?? []).map((c) => c.local_name).join(" › "),
    brandId: raw.brand?.id ?? null,
    attributes: (raw.product_attributes ?? []).map((a) => ({ id: a.id, value: (a.values ?? []).map((v) => v.name).join(", ") })),
    weightKg: kg(raw.package_weight),
    length: dm?.length ?? "",
    width: dm?.width ?? "",
    height: dm?.height ?? "",
    minOrder: raw.minimum_order_quantity ?? null,
    cod: raw.is_cod_allowed,
    preOwned: raw.is_pre_owned,
    platforms: (raw.integrated_platform_statuses ?? []).some((x) => x.platform === "TOKOPEDIA") ? ["TIKTOK_SHOP", "TOKOPEDIA"] : ["TIKTOK_SHOP"],
    certifications: [],
    video: raw.video?.id ? { id: raw.video.id, name: "Video saat ini" } : null,
    saveMode: "LISTING",
  };

  return (
    <div className="space-y-5">
      {back}
      <div>
        <h1 className="text-24 font-semibold">Edit Produk</h1>
        <p className="text-14 text-muted-foreground">Perubahan langsung dikirim ke Tokopedia. Stok & harga per varian diubah di halaman detail.</p>
      </div>
      <ProductForm initial={initial} brandName={raw.brand?.name ?? null} />
    </div>
  );
}
