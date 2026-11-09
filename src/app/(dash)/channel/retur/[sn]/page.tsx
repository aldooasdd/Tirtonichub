import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import * as rt from "@/server/marketplace/shopee-returns";
import { ReturnActions } from "@/components/channel/return-actions";
import { RETURN_STATUS } from "@/lib/return-status";
import { fmtWIB } from "@/lib/datetime";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const at = (t: number) => (t ? fmtWIB(new Date(t * 1000)) : "-");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal mengambil data.");
const OPEN = new Set(["REQUESTED", "PROCESSING", "JUDGING", "SELLER_DISPUTE"]);

function Info({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-12 text-muted-foreground">{k}</dt>
      <dd className="text-14">{children || "-"}</dd>
    </div>
  );
}

/** Detail retur Shopee + tanggapi. */
export default async function ReturDetail({ params }: { params: Promise<{ sn: string }> }) {
  await requireChannel();
  const { sn } = await params;
  const back = (
    <Link href="/channel/retur" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" /> Retur Shopee
    </Link>
  );
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO) return <div className="space-y-5">{back}<p className="text-destructive">Toko Shopee belum tersambung.</p></div>;
  const s = await fresh(shop);
  const c = { token: s.accessToken, shopId: s.shopId };
  const [d, sol, rs, tr] = await Promise.allSettled([rt.returnDetail(c, sn), rt.availableSolutions(c, sn), rt.disputeReasons(c, sn), rt.reverseTracking(c, sn)]);
  if (d.status === "rejected")
    return (
      <div className="space-y-5">
        {back}
        <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{errMsg(d.reason)}</p>
      </div>
    );
  const r = d.value;
  const st = RETURN_STATUS[r.status];
  const track = tr.status === "fulfilled" ? tr.value : null;
  const n = r.negotiationInfo;

  return (
    <div className="space-y-5">
      {back}
      <div>
        <h1 className="text-24 font-semibold">Retur {r.sn}</h1>
        <p className={`text-14 font-medium ${st?.tone ?? ""}`}>{st?.label ?? r.status}</p>
      </div>
      <dl className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <Info k="Order">{r.orderSn}</Info>
        <Info k="Pembeli">{r.buyer}</Info>
        <Info k="Dana diminta">{rupiah(r.refund)}</Info>
        <Info k="Alasan">{r.reason}</Info>
        <Info k="Keterangan pembeli">{r.textReason}</Info>
        <Info k="Barang dikirim balik">{r.needsLogistics ? "Ya" : "Tidak"}</Info>
        <Info k="Dibuat">{at(r.created)}</Info>
        <Info k="Batas tanggapi">{at(r.due)}</Info>
        <Info k="Batas kirim bukti">{at(r.proofDeadline)}</Info>
        <Info k="Status negosiasi">{r.negotiation}</Info>
        <Info k="Status bukti">{r.proof}</Info>
        <Info k="Kompensasi">{r.compensation}{r.compensationAmount ? ` · ${rupiah(r.compensationAmount)}` : ""}</Info>
        {n && <Info k="Tawaran terakhir">{`${n.solution} ${rupiah(n.offer)} oleh ${n.by} · sisa ${n.counterLeft}x · batas ${at(n.due)}`}</Info>}
        <Info k="Kurir retur">{r.carrier}</Info>
        <Info k="Alamat jemput">{r.pickup}</Info>
      </dl>

      <section className="space-y-2">
        <h2 className="text-18 font-semibold">Produk</h2>
        <ul className="divide-y rounded-lg border bg-card text-14">
          {r.items.map((i) => (
            <li key={`${i.itemId}-${i.modelId}`} className="flex items-center gap-3 p-3">
              {i.image && (
                // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN Shopee
                <img src={i.image} alt="" className="size-12 rounded-md border object-cover" />
              )}
              <span className="flex-1">
                {i.name}
                <span className="block text-12 text-muted-foreground">{i.sku || "-"} · ×{i.qty}</span>
              </span>
              <span className="tabular-nums">{rupiah(i.refund)}</span>
            </li>
          ))}
        </ul>
      </section>

      {(r.images.length > 0 || r.videos.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-18 font-semibold">Bukti pembeli</h2>
          <div className="flex flex-wrap gap-2">
            {r.images.map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto dari CDN Shopee */}
                <img src={src} alt="" className="size-24 rounded-md border object-cover" />
              </a>
            ))}
            {r.videos.map((v) => (
              <video key={v.url} src={v.url} poster={v.thumb} controls preload="none" className="h-24 rounded-md border">
                <track kind="captions" />
              </video>
            ))}
          </div>
        </section>
      )}

      {track && (track.tracking || track.events.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-18 font-semibold">Lacak paket retur {track.tracking && <span className="font-mono text-14">{track.tracking}</span>}</h2>
          <ol className="space-y-1 rounded-lg border bg-card p-4 text-14">
            {track.status && <li className="font-medium">{track.status}</li>}
            {track.events.map((e, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{at(e.time)}</span> · {e.text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {OPEN.has(r.status) && (
        <ReturnActions
          sn={r.sn}
          refund={r.refund}
          solutions={sol.status === "fulfilled" ? sol.value : null}
          reasons={rs.status === "fulfilled" ? rs.value : []}
          canAccept={!!n && n.by !== "seller" && n.offer > 0}
        />
      )}
    </div>
  );
}
