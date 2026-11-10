import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { PLATFORM_LABEL } from "@/server/marketplace/sync";
import { loadProductGroups } from "@/server/marketplace/product-groups";
import { RestoreButton } from "@/components/channel/restore-button";

const TAG: Record<string, string> = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600", WEBSITE: "bg-sky-500/15 text-sky-600" };
const label = (p: string) => PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] ?? p;

/** Sampah Produk Master: produk yang dihapus (tidak permanen), bisa dipulihkan. */
export default async function SampahProdukPage() {
  await requireProduk();
  const rows = (await loadProductGroups(true)).sort((a, b) => a.title.localeCompare(b.title, "id"));
  return (
    <div className="space-y-5">
      <Link href="/channel/produk" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Produk Master
      </Link>
      <div>
        <h1 className="text-24 font-semibold">Sampah Produk</h1>
        <p className="text-14 text-muted-foreground">{rows.length} produk. Hanya disembunyikan dari Produk Master, produk di marketplace tidak ikut terhapus.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sampah kosong.</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((g) => {
            const first = g.listings[0];
            return (
              <div key={g.key} className="flex items-center gap-3 p-3">
                {g.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                  <img src={g.image} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
                ) : (
                  <span className="size-12 shrink-0 rounded-md bg-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/channel/produk/${first.platform}/${first.itemId}`} className="line-clamp-2 font-medium hover:underline">
                    {g.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {g.listings.map((l) => (
                      <span key={`${l.platform}:${l.itemId}`} className={`rounded px-1.5 py-0.5 text-12 font-medium ${TAG[l.platform] ?? "bg-muted"}`}>
                        {label(l.platform)} · {l.stock}
                      </span>
                    ))}
                  </div>
                </div>
                <RestoreButton platform={first.platform} itemId={first.itemId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
