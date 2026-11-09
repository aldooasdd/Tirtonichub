import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import * as fin from "@/server/marketplace/shopee-finance";
import { ShopeeReport } from "@/components/channel/shopee-report";
import { fmtWIB } from "@/lib/datetime";

const rupiah = (n: number) => (n < 0 ? "-" : "") + "Rp " + new Intl.NumberFormat("id-ID").format(Math.abs(Math.round(n)));
const at = (t: number) => (t ? fmtWIB(new Date(t * 1000)) : "-");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal mengambil data.");
const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const day = (iso: string, end = false) => Math.floor(new Date(`${iso}T${end ? "23:59:59" : "00:00:00"}+07:00`).getTime() / 1000);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "mutasi", label: "Mutasi Saldo" },
  { key: "penghasilan", label: "Penghasilan" },
  { key: "billing", label: "Tagihan & Potongan" },
  { key: "dilepas", label: "Dana Dilepas" },
  { key: "pencairan", label: "Pencairan" },
  { key: "laporan", label: "Laporan" },
] as const;
type Tab = (typeof TABS)[number]["key"];
type SP = { tab?: string; from?: string; to?: string; s?: string };

/** Rentang dari URL; default 7 hari, maks 15 hari (batas Shopee). */
function range(sp: SP) {
  const today = wibDate(new Date());
  let to = sp.to && ISO.test(sp.to) && sp.to <= today ? sp.to : today;
  let from = sp.from && ISO.test(sp.from) ? sp.from : wibDate(new Date(Date.now() - 6 * 86400_000));
  if (from > to) [from, to] = [to, from];
  const min = wibDate(new Date(new Date(to).getTime() - 14 * 86400_000));
  if (from < min) from = min;
  return { today, from, to };
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => <th className={`p-3 ${right ? "text-right" : ""}`}>{children}</th>;
const Td = ({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) => (
  <td className={`p-3 ${right ? "text-right tabular-nums whitespace-nowrap" : ""} ${mono ? "font-mono text-12" : ""}`}>{children}</td>
);
function Table({ head, rows, empty }: { head: React.ReactNode; rows: React.ReactNode[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-14">
        <thead>
          <tr className="border-b text-left text-muted-foreground">{head}</tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr:last-child]:border-b-0">
          {rows.length ? rows : (
            <tr>
              <td colSpan={20} className="p-6 text-center text-muted-foreground">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
const Card = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <div className="rounded-lg border bg-card p-4">
    <p className="text-12 text-muted-foreground">{k}</p>
    <p className={`text-18 font-semibold tabular-nums ${tone ?? ""}`}>{v}</p>
  </div>
);

/** Saldo Shopee: data keuangan resmi Shopee (modul Payment), langsung dari Shopee. */
export default async function SaldoShopeePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "ringkasan") as Tab;
  const { today, from, to } = range(sp);
  const head = (
    <div className="space-y-3">
      <div>
        <h1 className="text-24 font-semibold">Saldo Shopee</h1>
        <p className="text-14 text-muted-foreground">Saldo penjual, penghasilan, potongan & pencairan, langsung dari Shopee.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/channel/saldo-shopee?tab=${t.key}`} className={`rounded-md px-3 py-1.5 text-14 font-medium ${tab === t.key ? "bg-orange-500/15 text-orange-600" : "border text-muted-foreground"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
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
  const c = { token: s.accessToken, shopId: s.shopId };
  const field = "h-9 rounded-md border bg-background px-2 text-14";
  const dateForm = (extra?: React.ReactNode) => (
    <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
      <input type="hidden" name="tab" value={tab} />
      <label className="flex flex-col gap-1 text-12 text-muted-foreground">
        Dari
        <input type="date" name="from" defaultValue={from} max={today} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-12 text-muted-foreground">
        Sampai
        <input type="date" name="to" defaultValue={to} max={today} className={field} />
      </label>
      {extra}
      <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">
        Tampilkan
      </button>
      <span className="text-12 text-muted-foreground">Maks 15 hari.</span>
    </form>
  );

  // Ambil data dulu (try), render sesudahnya.
  type D =
    | { k: "ringkasan"; ov: { released: number; pending: number }; wal: fin.WalletTx[] }
    | { k: "mutasi"; rows: fin.WalletTx[] }
    | { k: "penghasilan"; st: 1 | 2; rows: fin.IncomeRow[] }
    | { k: "billing"; rows: fin.BillingRow[] }
    | { k: "dilepas"; rows: { orderSn: string; amount: number; releasedAt: number }[] }
    | { k: "pencairan"; rows: fin.Payout[]; err: string }
    | { k: "laporan" };
  let d: D | null = null;
  let error = "";
  try {
    if (tab === "ringkasan") {
      const [ov, wal] = await Promise.all([fin.incomeOverview(c), fin.walletTransactions(c, day(from), day(to, true)).catch(() => [])]);
      d = { k: tab, ov, wal };
    } else if (tab === "mutasi") {
      const rows = await fin.walletTransactions(c, day(from), day(to, true), { flow: sp.s === "in" ? "MONEY_IN" : sp.s === "out" ? "MONEY_OUT" : undefined });
      d = { k: tab, rows: rows.sort((a, b) => b.time - a.time) };
    } else if (tab === "penghasilan") {
      const st = sp.s === "pending" ? 2 : 1;
      d = { k: tab, st, rows: await fin.incomeDetail(c, st, from, to) };
    } else if (tab === "billing") {
      d = { k: tab, rows: await fin.billingTransactions(c, sp.s === "released" ? 2 : 1) };
    } else if (tab === "dilepas") {
      d = { k: tab, rows: (await fin.escrowList(c, day(from), day(to, true))).sort((a, b) => b.releasedAt - a.releasedAt) };
    } else if (tab === "pencairan") {
      const [a, b] = await Promise.allSettled([fin.payouts(c, day(from), day(to, true)), fin.payoutInfo(c, day(from), day(to, true))]);
      const rows = a.status === "fulfilled" && a.value.length ? a.value : b.status === "fulfilled" ? b.value : [];
      d = { k: tab, rows, err: a.status === "rejected" && b.status === "rejected" ? errMsg(a.reason) : "" };
    } else d = { k: "laporan" };
  } catch (e) {
    error = errMsg(e);
  }

  let body: React.ReactNode = null;
  if (error || !d)
    body = (
      <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">
        {error}
        <br />
        <span className="text-12">Kalau error izin: aktifkan modul Payment di app Shopee Open Platform, lalu Sambungkan ulang toko Shopee.</span>
      </p>
    );
  else if (d.k === "ringkasan") {
      const { wal, ov } = d;
      const masuk = wal.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0);
      const keluar = wal.filter((t) => t.amount < 0).reduce((n, t) => n + t.amount, 0);
      const saldo = wal.length ? [...wal].sort((a, b) => b.time - a.time)[0].balance : null;
      body = (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card k="Saldo penjual (terakhir)" v={saldo == null ? "-" : rupiah(saldo)} />
            <Card k="Penghasilan tertahan" v={rupiah(ov.pending)} tone="text-amber-600" />
            <Card k="Penghasilan sudah dilepas" v={rupiah(ov.released)} tone="text-emerald-600" />
            <Card k={`Saldo masuk ${from} – ${to}`} v={rupiah(masuk)} tone="text-emerald-600" />
            <Card k={`Saldo keluar ${from} – ${to}`} v={rupiah(keluar)} tone="text-destructive" />
          </section>
          {dateForm()}
        </>
      );
  }
  else if (d.k === "mutasi") {
      const { rows } = d;
      body = (
        <>
          {dateForm(
            <label className="flex flex-col gap-1 text-12 text-muted-foreground">
              Arus
              <select name="s" defaultValue={sp.s ?? ""} className={field}>
                <option value="">Semua</option>
                <option value="in">Masuk</option>
                <option value="out">Keluar</option>
              </select>
            </label>,
          )}
          <Table
            head={<><Th>Waktu</Th><Th>Jenis</Th><Th>Keterangan</Th><Th>Order / Retur</Th><Th right>Jumlah</Th><Th right>Saldo</Th><Th>Status</Th></>}
            empty="Tidak ada mutasi."
            rows={rows.map((t, i) => (
              <tr key={`${t.time}-${i}`}>
                <Td>{at(t.time)}</Td>
                <Td mono>{t.type}</Td>
                <Td>{[t.title, t.reason, t.buyer].filter(Boolean).join(" · ") || "-"}</Td>
                <Td mono>{t.orderSn || t.refundSn || "-"}</Td>
                <Td right><span className={t.amount < 0 ? "text-destructive" : "text-emerald-600"}>{rupiah(t.amount)}</span></Td>
                <Td right>{rupiah(t.balance)}</Td>
                <Td>{t.status}</Td>
              </tr>
            ))}
          />
        </>
      );
  }
  else if (d.k === "penghasilan") {
      const { rows, st } = d;
      body = (
        <>
          {dateForm(
            <label className="flex flex-col gap-1 text-12 text-muted-foreground">
              Status
              <select name="s" defaultValue={sp.s ?? ""} className={field}>
                <option value="">Sudah dilepas</option>
                <option value="pending">Tertahan (semua)</option>
              </select>
            </label>,
          )}
          <p className="text-14 text-muted-foreground">
            {rows.length} baris · total {rupiah(rows.reduce((n, r) => n + (st === 1 ? r.released : r.estimated), 0))}
          </p>
          <Table
            head={<><Th>Order</Th><Th>Keterangan</Th><Th>Status</Th><Th>Pembayaran</Th><Th>Dibuat</Th><Th>{st === 1 ? "Dilepas" : "Perkiraan cair"}</Th><Th right>Jumlah</Th></>}
            empty="Tidak ada data."
            rows={rows.map((r, i) => (
              <tr key={`${r.orderSn}-${i}`}>
                <Td mono>{r.orderSn}</Td>
                <Td>{r.desc || "-"}</Td>
                <Td>{r.status || "-"}</Td>
                <Td>{r.method || "-"}</Td>
                <Td>{at(r.created)}</Td>
                <Td>{at(st === 1 ? r.paidAt : r.estPayout)}</Td>
                <Td right>{rupiah(st === 1 ? r.released : r.estimated)}</Td>
              </tr>
            ))}
          />
        </>
      );
  }
  else if (d.k === "billing") {
      const { rows } = d;
      const byHeader = new Map<string, number>();
      for (const r of rows) byHeader.set(r.header || r.type || "-", (byHeader.get(r.header || r.type || "-") ?? 0) + r.amount);
      body = (
        <>
          <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
            <input type="hidden" name="tab" value={tab} />
            <select name="s" defaultValue={sp.s ?? ""} className={field}>
              <option value="">Akan dilepas</option>
              <option value="released">Sudah dilepas</option>
            </select>
            <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">Tampilkan</button>
          </form>
          {byHeader.size > 0 && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[...byHeader].map(([k, v]) => <Card key={k} k={k} v={rupiah(v)} tone={v < 0 ? "text-destructive" : undefined} />)}
            </section>
          )}
          <Table
            head={<><Th>Order</Th><Th>Jenis biaya</Th><Th>Skenario</Th><Th>Keterangan</Th><Th>Level</Th><Th>Status</Th><Th right>Jumlah</Th></>}
            empty="Tidak ada tagihan."
            rows={rows.map((r, i) => (
              <tr key={`${r.orderSn}-${i}`}>
                <Td mono>{r.orderSn || "-"}</Td>
                <Td>{r.header || r.type || "-"}</Td>
                <Td>{r.scenario || "-"}</Td>
                <Td>{r.remark || "-"}</Td>
                <Td>{r.level || "-"}</Td>
                <Td>{r.status || "-"}</Td>
                <Td right><span className={r.amount < 0 ? "text-destructive" : ""}>{rupiah(r.amount)}</span></Td>
              </tr>
            ))}
          />
        </>
      );
  }
  else if (d.k === "dilepas") {
      const { rows } = d;
      body = (
        <>
          {dateForm()}
          <p className="text-14 text-muted-foreground">{rows.length} order · total {rupiah(rows.reduce((n, r) => n + r.amount, 0))}</p>
          <Table
            head={<><Th>Order</Th><Th>Dilepas</Th><Th right>Jumlah</Th></>}
            empty="Tidak ada dana dilepas."
            rows={rows.map((r) => (
              <tr key={r.orderSn}>
                <Td mono>{r.orderSn}</Td>
                <Td>{at(r.releasedAt)}</Td>
                <Td right>{rupiah(r.amount)}</Td>
              </tr>
            ))}
          />
        </>
      );
  }
  else if (d.k === "pencairan") {
      const { rows, err } = d;
      body = (
        <>
          {dateForm()}
          {err && <p className="rounded-md bg-amber-500/10 p-3 text-14 text-amber-700">{err}. Endpoint pencairan Shopee ditujukan untuk toko lintas negara; untuk toko lokal lihat penarikan di tab Mutasi Saldo (jenis WITHDRAWAL).</p>}
          <Table
            head={<><Th>Waktu</Th><Th>Layanan</Th><Th>Rekening</Th><Th right>Order</Th><Th right>Jumlah</Th></>}
            empty="Tidak ada pencairan."
            rows={rows.map((r, i) => (
              <tr key={`${r.time}-${i}`}>
                <Td>{at(r.time)}</Td>
                <Td>{r.service || "-"}</Td>
                <Td mono>{r.payee || "-"}</Td>
                <Td right>{r.orders || "-"}</Td>
                <Td right>{rupiah(r.amount)}</Td>
              </tr>
            ))}
          />
        </>
      );
  }
  else body = <ShopeeReport />;

  return (
    <div className="space-y-5">
      {head}
      {body}
    </div>
  );
}
