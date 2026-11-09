import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import { reviews, type Review } from "@/server/marketplace/shopee-product";
import { ReviewReply } from "@/components/channel/shopee-product-ui";
import { shopeeNames } from "@/components/channel/shopee-ads-views";
import { fmtWIB } from "@/lib/datetime";

const at = (t: number) => (t ? fmtWIB(new Date(t * 1000)) : "-");
const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n)));
type SP = { r?: string; balas?: string; q?: string };

/** Ulasan Shopee: semua ulasan pembeli + balas. */
export default async function UlasanPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const head = (
    <div>
      <h1 className="text-24 font-semibold">Ulasan Shopee</h1>
      <p className="text-14 text-muted-foreground">Ulasan pembeli seluruh toko (500 terbaru) dan balas langsung dari sini.</p>
    </div>
  );
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO)
    return (
      <div className="space-y-5">
        {head}
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sambungkan toko Shopee asli dulu di Kelola Pesanan.</p>
      </div>
    );
  const s = await fresh(shop);
  let all: Review[] = [];
  let error = "";
  try {
    all = await reviews({ token: s.accessToken, shopId: s.shopId }, { max: 500 });
  } catch (e) {
    error = e instanceof Error ? e.message : "Gagal mengambil ulasan.";
  }
  const names = await shopeeNames();
  const q = (sp.q ?? "").toLowerCase();
  const rows = all
    .filter((r) => !sp.r || r.rating === Number(sp.r))
    .filter((r) => sp.balas !== "belum" || !r.reply)
    .filter((r) => !q || r.text.toLowerCase().includes(q) || (names.get(r.itemId) ?? "").toLowerCase().includes(q) || r.buyer.toLowerCase().includes(q));
  const avg = all.length ? all.reduce((n, r) => n + r.rating, 0) / all.length : 0;
  const belum = all.filter((r) => !r.reply).length;
  const field = "h-9 rounded-md border bg-background px-2 text-14";

  return (
    <div className="space-y-5">
      {head}
      {error && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{error}</p>}
      <p className="text-14 text-muted-foreground">
        {all.length} ulasan · rata-rata {avg.toFixed(2)} · {belum} belum dibalas · bintang 1–2: {all.filter((r) => r.rating <= 2).length}
      </p>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari isi ulasan, produk, pembeli" className={`${field} min-w-60 flex-1`} />
        <select name="r" defaultValue={sp.r ?? ""} className={field}>
          <option value="">Semua bintang</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} bintang</option>
          ))}
        </select>
        <select name="balas" defaultValue={sp.balas ?? ""} className={field}>
          <option value="">Semua</option>
          <option value="belum">Belum dibalas</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">Terapkan</button>
      </form>
      <ul className="divide-y rounded-lg border bg-card text-14">
        {rows.map((r) => (
          <li key={r.id} className="space-y-1 p-4">
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="text-amber-500">{stars(r.rating)}</span>
              <Link href={`/channel/produk/SHOPEE/${r.itemId}`} className="font-medium hover:underline">{names.get(r.itemId) ?? r.itemId}</Link>
            </p>
            <p className="text-12 text-muted-foreground">
              {r.buyer} · {at(r.time)}
              {r.orderSn ? ` · order ${r.orderSn}` : ""}
              {r.hidden ? " · disembunyikan" : ""}
            </p>
            {r.text && <p>{r.text}</p>}
            {r.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {r.images.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto dari CDN Shopee */}
                    <img src={src} alt="" className="size-16 rounded-md border object-cover" />
                  </a>
                ))}
              </div>
            )}
            {r.reply ? <p className="rounded bg-muted px-2 py-1 text-muted-foreground">Balasan ({at(r.replyTime)}): {r.reply}</p> : <ReviewReply id={r.id} />}
          </li>
        ))}
        {!rows.length && <li className="p-6 text-center text-muted-foreground">Tidak ada ulasan.</li>}
      </ul>
    </div>
  );
}
