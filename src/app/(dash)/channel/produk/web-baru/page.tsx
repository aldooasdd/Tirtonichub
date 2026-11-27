import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { websiteForm, websiteReady, type WebFormKategori } from "@/server/marketplace/website";
import { WebProductForm } from "@/components/channel/web-product-form";

/** Produk baru manual untuk tirtonic.com (tidak lewat Tokopedia). Field filter diambil dari web. */
export default async function WebProdukBaruPage() {
  await requireProduk();
  let kategori: WebFormKategori[] = [];
  let err = websiteReady() ? "" : "POINTS_API_SECRET belum diset — Tirtonichub belum tersambung ke tirtonic.com.";
  if (!err) {
    try {
      kategori = await websiteForm();
    } catch (e) {
      err = e instanceof Error ? e.message : "Gagal memuat data dari tirtonic.com.";
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/channel/produk" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Produk Master
      </Link>
      <div>
        <h1 className="text-24 font-semibold">Produk web baru</h1>
        <p className="text-14 text-muted-foreground">Produk langsung tayang di tirtonic.com begitu disimpan (kalau stoknya ada).</p>
      </div>
      {err ? <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{err}</p> : <WebProductForm kategori={kategori} />}
    </div>
  );
}
