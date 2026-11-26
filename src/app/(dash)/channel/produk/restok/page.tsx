import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { tokoGudang } from "@/server/pos-catalog";
import { Restok } from "@/components/channel/restok";

/** Restok: barang masuk → stok cabang bertambah, live ke Shopee & Tokopedia. Jalan pintas sebelum alur Purchasing. */
export default async function RestokPage() {
  await requireChannel();
  const toko = await tokoGudang();
  return (
    <div className="space-y-4">
      <div>
        <Link href="/channel/produk" className="text-14 text-muted-foreground">← Produk Master</Link>
        <h1 className="text-24 font-semibold">Restok</h1>
        <p className="text-14 text-muted-foreground">Pilih cabang, scan barcode atau cari nama barang, isi jumlah yang masuk, lalu Simpan. Stok ditambahkan ke stok sekarang dan langsung terkirim ke Shopee & Tokopedia.</p>
      </div>
      <Restok cabang={toko.map((t) => ({ id: t.id, label: t.label, bisa: t.keys.length > 0 }))} />
    </div>
  );
}
