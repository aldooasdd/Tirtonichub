import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { requireProduk } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { PLATFORM_LABEL } from "@/server/marketplace/sync";
import { loadProductGroups } from "@/server/marketplace/product-groups";
import { productStatus as statusInfo } from "@/lib/channel-status";
import { PRODUK_KE_MARKETPLACE, PRODUK_OFF_MSG } from "@/lib/flags";
import { PushWebButton } from "@/components/channel/push-web-button";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const TAG: Record<string, string> = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600", WEBSITE: "bg-sky-500/15 text-sky-600" };
const label = (p: string) => PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] ?? p;
type SP = { q?: string; status?: string; p?: string };

/** Produk Master: semua produk, yang bernama sama di beberapa marketplace digabung jadi 1 baris + badge tempat jualnya. */
export default async function ProdukMasterPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProduk();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  const [all, detailCount, sampah] = await Promise.all([
    loadProductGroups(),
    prisma.marketplaceProduct.count({ where: { platform: "TOKOPEDIA" } }),
    prisma.marketplaceItem.groupBy({ by: ["platform", "itemId"], where: { deletedAt: { not: null } } }),
  ]);
  const stockOf = (g: (typeof all)[number]) => g.listings.reduce((n, l) => n + l.stock, 0);

  const rows = all
    .filter((g) => !sp.p || g.listings.some((l) => l.platform === sp.p))
    .filter((g) =>
      !sp.status
        ? true
        : sp.status === "habis"
          ? stockOf(g) === 0
          : sp.status === "multi"
            ? new Set(g.listings.map((l) => l.platform)).size > 1
            : g.listings.some((l) => l.status === sp.status),
    )
    .filter((g) => !q || g.title.toLowerCase().includes(q) || g.skus.toLowerCase().includes(q) || (g.brand ?? "").toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, "id"));
  const habis = all.filter((g) => stockOf(g) === 0).length;
  const multi = all.filter((g) => new Set(g.listings.map((l) => l.platform)).size > 1).length;
  const tokoProducts = new Set(all.flatMap((g) => g.listings.filter((l) => l.platform === "TOKOPEDIA" && !l.demo).map((l) => l.itemId))).size;
  const tanpaDetail = Math.max(0, tokoProducts - detailCount);
  const field = "h-9 rounded-md border bg-background px-2 text-14";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Produk Master</h1>
          <p className="text-14 text-muted-foreground">
            {all.length} produk{multi ? ` · ${multi} dijual di lebih dari 1 toko` : ""}
            {habis ? ` · ${habis} stok habis` : ""}. Klik produk untuk ubah harga & stok per marketplace.
          </p>
          {tanpaDetail > 0 && <p className="mt-1 text-12 text-amber-600">{tanpaDetail} produk Tokopedia detailnya (foto, kategori, merek, deskripsi) sedang disinkron di latar belakang. Muat ulang halaman beberapa menit lagi.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
        <Link href="/channel/produk/sampah" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-14 font-medium">
          <Trash2 className="size-4" /> Sampah{sampah.length ? ` (${sampah.length})` : ""}
        </Link>
        {PRODUK_KE_MARKETPLACE ? (
          <Link href="/channel/produk/baru" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">
            <Plus className="size-4" /> Tambah produk
          </Link>
        ) : (
          <p className="max-w-xs rounded-md bg-amber-500/10 px-3 py-2 text-12 text-amber-700">{PRODUK_OFF_MSG}</p>
        )}
        </div>
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
            <option value="ACTIVATE">Aktif (Tokopedia)</option>
            <option value="SELLER_DEACTIVATED">Nonaktif (Tokopedia)</option>
            <option value="DRAFT">Draft</option>
            <option value="habis">Stok habis</option>
            <option value="multi">Dijual di &gt;1 toko</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Toko
          <select name="p" defaultValue={sp.p ?? ""} className={field}>
            <option value="">Semua toko</option>
            <option value="TOKOPEDIA">Tokopedia</option>
            <option value="SHOPEE">Shopee</option>
            <option value="WEBSITE">Tirtonic.com</option>
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
                <th className="p-3">Dijual di (stok)</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-right">Harga</th>
                <th className="p-3">Web</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const first = g.listings[0];
                const st = statusInfo(g.listings.find((l) => l.status)?.status);
                const min = Math.min(...g.listings.map((l) => l.minPrice));
                const max = Math.max(...g.listings.map((l) => l.maxPrice));
                return (
                  <tr key={g.key} className="border-b align-top last:border-b-0 hover:bg-muted/40">
                    <td className="p-3">
                      <Link href={`/channel/produk/${first.platform}/${first.itemId}`} className="flex items-center gap-3">
                        {g.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                          <img src={g.image} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
                        ) : (
                          <span className="size-12 shrink-0 rounded-md bg-muted" aria-hidden />
                        )}
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-medium hover:underline">{g.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-12 text-muted-foreground">
                            {g.brand && <span>{g.brand}</span>}
                            {st && <span className={st.tone}>{st.label}</span>}
                            {g.listings.some((l) => l.demo) && <span className="text-amber-600">contoh</span>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {g.listings.map((l) => (
                          <span
                            key={`${l.platform}:${l.itemId}`}
                            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-12 font-medium ${TAG[l.platform] ?? "bg-muted"} ${l.active ? "" : "opacity-50"}`}
                            title={l.active ? undefined : "Tidak aktif di toko ini"}
                          >
                            {label(l.platform)} · <span className={l.stock === 0 ? "text-destructive" : ""}>{l.stock}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{g.category ?? "-"}</td>
                    <td className="p-3 text-right whitespace-nowrap tabular-nums">{min === max ? rupiah(min) : `${rupiah(min)} – ${rupiah(max)}`}</td>
                    <td className="p-3">
                      {(() => {
                        const toko = g.listings.find((l) => l.platform === "TOKOPEDIA" && !l.demo);
                        const onWeb = g.listings.some((l) => l.platform === "WEBSITE");
                        return toko ? <PushWebButton itemId={toko.itemId} onWeb={onWeb} /> : <span className="text-12 text-muted-foreground">-</span>;
                      })()}
                    </td>
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
