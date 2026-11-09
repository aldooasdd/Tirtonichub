// Panel Shopee di detail Produk Master: statistik, pelanggaran, diagnosis, promo, naikkan, ulasan.
import Link from "next/link";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import * as sp from "@/server/marketplace/shopee-product";
import { ReviewReply, ShopeeItemOps } from "@/components/channel/shopee-product-ui";
import { PRODUK_KE_MARKETPLACE } from "@/lib/flags";
import { fmtWIB } from "@/lib/datetime";

const num = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const rupiah = (n: number) => "Rp " + num(Math.round(n));
const at = (t: number) => (t ? fmtWIB(new Date(t * 1000)) : "-");
const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n)));

export async function ShopeeProductPanel({ itemId, name, unlisted }: { itemId: string; name: string; unlisted: boolean }) {
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO) return null;
  const s = await fresh(shop);
  const c = { token: s.accessToken, shopId: s.shopId };
  const [ex, vi, dg, pr, bo, rv] = await Promise.allSettled([
    sp.extraInfo(c, [itemId]),
    sp.violations(c, [itemId]),
    sp.diagnosis(c, [itemId]),
    sp.promotions(c, [itemId]),
    sp.boosted(c),
    sp.reviews(c, { itemId, max: 30 }),
  ]);
  const e = ex.status === "fulfilled" ? ex.value[0] : undefined;
  const v = vi.status === "fulfilled" ? vi.value[0] : undefined;
  const d = dg.status === "fulfilled" ? dg.value[0] : undefined;
  const promos = pr.status === "fulfilled" ? pr.value : [];
  const cd = bo.status === "fulfilled" ? (bo.value.find((b) => b.itemId === itemId)?.cooldown ?? 0) : 0;
  const reviews = rv.status === "fulfilled" ? rv.value : [];
  const errs = [ex, vi, dg, pr, rv].filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason?.message ?? r));

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-18 font-semibold">
        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-14 text-orange-600">Shopee</span> performa & kesehatan
      </h2>
      {errs.length > 0 && <p className="text-12 text-destructive">{errs.join(" · ")}</p>}
      {e && (
        <dl className="grid gap-3 sm:grid-cols-5">
          {[
            ["Terjual", num(e.sale)],
            ["Dilihat", num(e.views)],
            ["Disukai", num(e.likes)],
            ["Rating", e.rating ? `${e.rating.toFixed(1)} / 5` : "-"],
            ["Ulasan", num(e.comments)],
          ].map(([k, x]) => (
            <div key={k}>
              <dt className="text-12 text-muted-foreground">{k}</dt>
              <dd className="text-18 font-semibold tabular-nums">{x}</dd>
            </div>
          ))}
        </dl>
      )}
      <ShopeeItemOps itemId={itemId} cooldown={cd} writable={PRODUK_KE_MARKETPLACE} unlisted={unlisted} name={name} />

      {v && (v.issues.length > 0 || v.deboost || (v.status && v.status !== "NORMAL")) && (
        <div className="space-y-1 rounded-md bg-destructive/10 p-3 text-14">
          <p className="font-medium text-destructive">
            Status: {v.status}
            {v.deboost ? " · peringkat pencarian diturunkan" : ""}
          </p>
          {v.issues.map((i, n) => (
            <p key={n}>
              <span className="font-medium">{i.type}</span>: {i.reason}
              {i.suggestion && <span className="block text-muted-foreground">Saran: {i.suggestion}</span>}
              {i.deadline > 0 && <span className="block text-12 text-destructive">Batas perbaiki {at(i.deadline)}</span>}
            </p>
          ))}
        </div>
      )}
      {d && (
        <div className="text-14">
          <p>
            Kualitas konten: <span className="font-medium">{d.quality}</span>
          </p>
          {d.tasks.length > 0 && (
            <ul className="list-disc pl-5 text-muted-foreground">
              {d.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {promos.length > 0 && (
        <div className="text-14">
          <p className="font-medium">Sedang / akan ikut promo</p>
          <ul className="text-muted-foreground">
            {promos.map((p) => (
              <li key={`${p.id}-${p.modelId}`}>
                {p.type} ({p.stage}) · {at(p.start)} – {at(p.end)}
                {p.price ? ` · ${rupiah(p.price)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Ulasan terbaru ({reviews.length})</p>
          <Link href="/channel/ulasan" className="text-14 text-primary hover:underline">Semua ulasan</Link>
        </div>
        <ul className="divide-y rounded-md border text-14">
          {reviews.slice(0, 10).map((r) => (
            <li key={r.id} className="space-y-1 p-3">
              <p>
                <span className="text-amber-500">{stars(r.rating)}</span> <span className="text-muted-foreground">{r.buyer} · {at(r.time)}</span>
              </p>
              {r.text && <p>{r.text}</p>}
              {r.reply ? <p className="rounded bg-muted px-2 py-1 text-muted-foreground">Balasan: {r.reply}</p> : <ReviewReply id={r.id} />}
            </li>
          ))}
          {!reviews.length && <li className="p-3 text-muted-foreground">Belum ada ulasan.</li>}
        </ul>
      </div>
    </section>
  );
}
