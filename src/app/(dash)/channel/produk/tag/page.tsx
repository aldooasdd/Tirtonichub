import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { PasangTag } from "@/components/channel/pasang-tag";

/** Pasangkan Tag: stiker RFID ↔ SKU, pakai reader HC-YK947 mode keyboard. */
export default async function PasangTagPage() {
  await requireChannel();
  const [tags, skus] = await Promise.all([prisma.rfidTag.count(), prisma.rfidTag.groupBy({ by: ["sku"] }).then((g) => g.length)]);
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/channel/produk" className="text-14 text-muted-foreground">← Produk Master</Link>
        <h1 className="text-24 font-semibold">Pasangkan Tag</h1>
        <p className="text-14 text-muted-foreground">
          Scan barcode barang, sapu stikernya sampai baris ID tag terisi, lalu tekan Simpan. Total {tags} tag di {skus} SKU.{" "}
          <Link href="/channel/produk/tag/data" className="text-primary underline">Lihat data tag</Link>
        </p>
      </div>
      <PasangTag />
    </div>
  );
}
