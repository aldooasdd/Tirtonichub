import Link from "next/link";
import { requireProduk } from "@/server/auth/rbac";
import { SkuImport } from "@/components/channel/sku-import";

export default async function SkuPage() {
  await requireProduk();
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link href="/channel/produk" className="text-14 text-muted-foreground">← Produk Master</Link>
        <h1 className="text-24 font-semibold">Isi SKU massal</h1>
        <p className="text-14 text-muted-foreground">SKU hanya disimpan di Tirtonichub (dipakai kasir & stok cabang). Shopee / Tokopedia tidak berubah.</p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-14">
        <li>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- unduhan file dari route handler */}
          <a href="/channel/produk/sku/export" className="font-medium text-primary underline">Download Excel semua varian</a>.
        </li>
        <li>Isi / ubah kolom <b>SKU Tirtonichub</b>. Jangan ubah kolom ID.</li>
        <li>Upload di bawah → cek pratinjau → Simpan.</li>
      </ol>
      <SkuImport />
    </div>
  );
}
