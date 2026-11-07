import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { DEMO, PLATFORM_LABEL } from "@/server/marketplace/sync";
import { productStatus as statusInfo } from "@/lib/channel-status";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const TAG: Record<string, string> = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600" };
type SP = { q?: string; status?: string; p?: string };

/** Produk Master: semua produk marketplace (1 baris per produk) + ringkasan varian, stok, harga. */
export default async function ProdukMasterPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  const [items, details] = await Promise.all([
    prisma.marketplaceItem.findMany({ orderBy: { name: "asc" } }),
    prisma.marketplaceProduct.findMany(),
  ]);
  const det = new Map(details.map((d) => [`${d.platform}:${d.productId}`, d]));

  // Kelompokkan varian per produk.
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const k = `${it.platform}:${it.itemId}`;
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const all = [...groups].map(([k, vs]) => {
    const d = det.get(k);
    const prices = vs.map((v) => v.price);
    return {
      key: k,
      platform: vs[0].platform,
      itemId: vs[0].itemId,
      demo: vs[0].shopId === DEMO,
      title: d?.title ?? vs[0].name.replace(/\s*\([^)]*\)$/, ""),
      image: ((d?.images as string[] | undefined) ?? [])[0] ?? vs.find((v) => v.image)?.image ?? null,
      category: d?.category?.split(" › ").pop() ?? null,
      brand: d?.brand ?? null,
      status: d?.status ?? null,
      variants: vs.length,
      stock: vs.reduce((n, v) => n + v.stock, 0),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      skus: vs.map((v) => v.sku ?? "").join(" "),
      hasDetail: !!d,
    };
  });

  const rows = all
    .filter((r) => !sp.p || r.platform === sp.p)
    .filter((r) => !sp.status || (sp.status === "habis" ? r.stock === 0 : r.status === sp.status))
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.skus.toLowerCase().includes(q) || (r.brand ?? "").toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, "id"));
  const habis = all.filter((r) => r.stock === 0).length;
  const tanpaDetail = all.filter((r) => r.platform === "TOKOPEDIA" && !r.hasDetail && !r.demo).length;
  const field = "h-9 rounded-md border bg-background px-2 text-14";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Produk Master</h1>
        <p className="text-14 text-muted-foreground">
          {all.length} produk dari marketplace{habis ? ` · ${habis} stok habis` : ""}. Klik produk untuk detail lengkap & ubah stok / harga per varian.
        </p>
        {tanpaDetail > 0 && <p className="mt-1 text-12 text-amber-600">{tanpaDetail} produk Tokopedia detailnya (foto, kategori, merek, deskripsi) sedang disinkron di latar belakang. Muat ulang halaman beberapa menit lagi.</p>}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-12 text-muted-foreground">
          Cari
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Nama produk, SKU, merek" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Status
          <select name="status" defaultValue={sp.status ?? ""} className={field}>
            <option value="">Semua</option>
            <option value="ACTIVATE">Aktif</option>
            <option value="SELLER_DEACTIVATED">Nonaktif</option>
            <option value="DRAFT">Draft</option>
            <option value="habis">Stok habis</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Toko
          <select name="p" defaultValue={sp.p ?? ""} className={field}>
            <option value="">Semua toko</option>
            <option value="TOKOPEDIA">Tokopedia</option>
            <option value="SHOPEE">Shopee</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">
          Terapkan
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">{all.length ? "Tidak ada produk yang cocok." : "Belum ada produk. Sinkron toko dulu."}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Produk</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Varian</th>
                <th className="p-3 text-right">Stok</th>
                <th className="p-3 text-right">Harga</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = statusInfo(r.status);
                return (
                  <tr key={r.key} className="border-b align-top last:border-b-0 hover:bg-muted/40">
                    <td className="p-3">
                      <Link href={`/channel/produk/${r.platform}/${r.itemId}`} className="flex items-center gap-3">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                          <img src={r.image} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
                        ) : (
                          <span className="size-12 shrink-0 rounded-md bg-muted" aria-hidden />
                        )}
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-medium hover:underline">{r.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-12 text-muted-foreground">
                            <span className={`rounded px-1.5 py-0.5 font-medium ${TAG[r.platform] ?? "bg-muted"}`}>{PLATFORM_LABEL[r.platform as keyof typeof PLATFORM_LABEL] ?? r.platform}</span>
                            {r.brand && <span>{r.brand}</span>}
                            {r.demo && <span className="text-amber-600">contoh</span>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.category ?? "-"}</td>
                    <td className={`p-3 whitespace-nowrap ${st?.tone ?? "text-muted-foreground"}`}>{st?.label ?? "-"}</td>
                    <td className="p-3 text-right tabular-nums">{r.variants}</td>
                    <td className={`p-3 text-right tabular-nums ${r.stock === 0 ? "font-semibold text-destructive" : ""}`}>{r.stock}</td>
                    <td className="p-3 text-right whitespace-nowrap tabular-nums">{r.minPrice === r.maxPrice ? rupiah(r.minPrice) : `${rupiah(r.minPrice)} – ${rupiah(r.maxPrice)}`}</td>
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
