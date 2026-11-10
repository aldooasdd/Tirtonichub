import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { PRODUK_KE_MARKETPLACE } from "@/lib/flags";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import { listingPrerequisites } from "@/server/marketplace/tiktok-product";
import { ProductForm } from "@/components/channel/product-form";

const CHECK_LABEL: Record<string, string> = {
  SHOP_STATUS: "Status toko",
  SHOP_TAX: "Data pajak toko",
  PICKUP_WAREHOUSE: "Gudang pengambilan",
  RETURN_WAREHOUSE: "Gudang retur",
  DELIVERY_OPTION: "Opsi pengiriman",
  SHIPPING_TEMPLATE: "Template ongkir",
};

/** Tambah produk baru ke Tokopedia (Create Product). Syarat toko dicek dulu (Check Listing Prerequisites). */
export default async function TambahProdukPage() {
  await requireProduk();
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

  return (
    <div className="space-y-5">
      <Link href="/channel/produk" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Produk Master
      </Link>
      <div>
        <h1 className="text-24 font-semibold">Tambah Produk</h1>
        <p className="text-14 text-muted-foreground">Produk baru langsung dibuat di Tokopedia.</p>
      </div>
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
          initial={{
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
