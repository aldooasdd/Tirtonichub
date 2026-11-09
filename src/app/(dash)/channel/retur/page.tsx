import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import { returnList, type ReturnRow } from "@/server/marketplace/shopee-returns";
import { fmtWIB } from "@/lib/datetime";
import { RETURN_STATUS } from "@/lib/return-status";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const at = (t: number) => (t ? fmtWIB(new Date(t * 1000)) : "-");
const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const day = (iso: string, end = false) => Math.floor(new Date(`${iso}T${end ? "23:59:59" : "00:00:00"}+07:00`).getTime() / 1000);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
type SP = { from?: string; to?: string; status?: string };

function range(sp: SP) {
  const today = wibDate(new Date());
  let to = sp.to && ISO.test(sp.to) && sp.to <= today ? sp.to : today;
  let from = sp.from && ISO.test(sp.from) ? sp.from : wibDate(new Date(Date.now() - 14 * 86400_000));
  if (from > to) [from, to] = [to, from];
  const min = wibDate(new Date(new Date(to).getTime() - 14 * 86400_000));
  if (from < min) from = min;
  return { today, from, to };
}

/** Retur Shopee: daftar pengembalian barang/dana. */
export default async function ReturPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const { today, from, to } = range(sp);
  const head = (
    <div>
      <h1 className="text-24 font-semibold">Retur Shopee</h1>
      <p className="text-14 text-muted-foreground">Pengajuan pengembalian barang / dana dari pembeli. Maks 15 hari per tampilan.</p>
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
  let rows: ReturnRow[] = [];
  let error = "";
  try {
    rows = (await returnList({ token: s.accessToken, shopId: s.shopId }, day(from), day(to, true), sp.status || undefined)).sort((a, b) => b.created - a.created);
  } catch (e) {
    error = e instanceof Error ? e.message : "Gagal mengambil data.";
  }
  const field = "h-9 rounded-md border bg-background px-2 text-14";
  const perlu = rows.filter((r) => r.status === "REQUESTED" || r.status === "PROCESSING").length;

  return (
    <div className="space-y-5">
      {head}
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Dari
          <input type="date" name="from" defaultValue={from} max={today} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Sampai
          <input type="date" name="to" defaultValue={to} max={today} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Status
          <select name="status" defaultValue={sp.status ?? ""} className={field}>
            <option value="">Semua</option>
            {Object.entries(RETURN_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">Tampilkan</button>
      </form>
      {error && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{error}</p>}
      <p className="text-14 text-muted-foreground">
        {rows.length} retur{perlu ? ` · ${perlu} perlu ditanggapi` : ""} · total dana {rupiah(rows.reduce((n, r) => n + r.refund, 0))}
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Retur</th>
              <th className="p-3">Produk</th>
              <th className="p-3">Alasan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Batas tanggapi</th>
              <th className="p-3 text-right">Dana</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">Tidak ada retur.</td>
              </tr>
            ) : (
              rows.map((r) => {
                const st = RETURN_STATUS[r.status];
                return (
                  <tr key={r.sn} className="border-b align-top last:border-b-0">
                    <td className="p-3">
                      <Link href={`/channel/retur/${r.sn}`} className="font-mono text-12 font-medium text-primary hover:underline">{r.sn}</Link>
                      <p className="text-12 text-muted-foreground">Order {r.orderSn} · {at(r.created)}</p>
                      {r.buyer && <p className="text-12 text-muted-foreground">{r.buyer}</p>}
                    </td>
                    <td className="p-3">{r.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
                    <td className="p-3">{r.reason}{r.textReason ? <p className="text-12 text-muted-foreground">{r.textReason}</p> : null}</td>
                    <td className={`p-3 font-medium ${st?.tone ?? ""}`}>{st?.label ?? r.status}</td>
                    <td className="p-3 whitespace-nowrap">{at(r.due)}</td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">{rupiah(r.refund)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
