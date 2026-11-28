import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { userNames } from "@/server/user-names";
import type { DraftData } from "@/lib/product-draft";

/** Draft produk Tirtonichub: satu draft untuk semua toko. Orang produk isi data → QC isi SKU + RFID → tayang. */
export default async function DraftProdukPage() {
  await requireProduk();
  const rows = await prisma.draftProduk.findMany({ orderBy: { updatedAt: "desc" } });
  const vs = rows.map((r) => ((r.data as unknown as DraftData).d.variants ?? []));
  const skus = [...new Set(vs.flat().map((v) => v.sellerSku.trim().toLowerCase()).filter(Boolean))];
  const [tags, names] = await Promise.all([
    skus.length ? prisma.rfidTag.findMany({ where: { sku: { in: skus, mode: "insensitive" } }, select: { sku: true } }) : [],
    userNames(rows.map((r) => r.updatedBy)),
  ]);
  const tagOf = (sku: string) => tags.filter((t) => t.sku.toLowerCase() === sku.trim().toLowerCase()).length;

  return (
    <div className="space-y-4">
      <Link href="/channel/produk" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Produk Master
      </Link>
      <div>
        <h1 className="text-24 font-semibold">Draft produk</h1>
        <p className="text-14 text-muted-foreground">Satu draft untuk semua toko. Orang produk isi data barang lewat Tambah produk → Simpan draft. QC buka draft, isi SKU tiap varian dan pasang RFID, lalu Simpan & tayangkan.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada draft.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-normal">Produk</th>
                <th className="p-3 font-normal">SKU</th>
                <th className="p-3 font-normal">RFID</th>
                <th className="p-3 font-normal">Terakhir diubah</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr:last-child]:border-b-0">
              {rows.map((r, i) => {
                const v = vs[i];
                const isi = v.filter((x) => x.sellerSku.trim());
                const rfid = isi.filter((x) => tagOf(x.sellerSku) > 0).length;
                const img = (r.data as unknown as DraftData).d.images[0]?.url;
                return (
                  <tr key={r.id}>
                    <td className="p-3">
                      <Link href={`/channel/produk/baru?draft=${r.id}`} className="flex items-center gap-2 hover:underline">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                          <img src={img} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
                        ) : <span className="size-10 shrink-0 rounded-md border bg-muted" />}
                        {r.title}
                      </Link>
                    </td>
                    <td className={`p-3 ${isi.length < v.length ? "text-amber-600" : "text-emerald-600"}`}>{isi.length}/{v.length} varian</td>
                    <td className={`p-3 ${rfid < v.length ? "text-amber-600" : "text-emerald-600"}`}>{rfid}/{v.length} varian</td>
                    <td className="p-3 text-muted-foreground">{r.updatedAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}{r.updatedBy ? ` · ${names(r.updatedBy)}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
