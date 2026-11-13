import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { SkuCheckCard, SkuCheckLoad, SkuCheckPush } from "@/components/channel/sku-check";

const TOKO: Record<string, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Tirtonic.com" };
const PER_PAGE = 30;
type SP = { q?: string; s?: string; k?: string; page?: string };

/** Cek SKU: barang yang SKU-nya belum yakin dari Accurate. Orang toko konfirmasi saran / scan barcode (Zebra). */
export default async function CekSkuPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const status = sp.s === "done" || sp.s === "missing" ? sp.s : "pending";
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page) || 1);

  const [all, unpushed] = await Promise.all([
    prisma.skuCheck.findMany({ orderBy: { groupKey: "asc" } }),
    prisma.skuCheck.count({ where: { status: "done", pushedAt: null, sku: { not: null } } }),
  ]);
  // Kelompokkan per groupKey (varian sama di beberapa toko = 1 kartu).
  const groups = new Map<string, typeof all>();
  for (const r of all) (groups.get(r.groupKey) ?? groups.set(r.groupKey, []).get(r.groupKey)!).push(r);
  const list = [...groups.values()];
  const count = (st: string) => list.filter((g) => g[0].status === st).length;

  const shown = list
    .filter((g) => g[0].status === status)
    .filter((g) => !sp.k || g[0].kind === sp.k)
    .filter((g) => !q || g[0].groupKey.includes(q) || (g[0].saranNama ?? "").toLowerCase().includes(q));
  const pageRows = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const items = await prisma.marketplaceItem.findMany({ where: { id: { in: pageRows.flat().map((r) => r.itemId) } } });
  const itemById = new Map(items.map((i) => [i.id, i]));
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(pageRows.map((g) => g[0].checkedById).filter(Boolean) as string[])] } }, select: { id: true, fullName: true, nickname: true } });
  const userName = new Map(users.map((u) => [u.id, u.nickname || u.fullName]));

  const total = list.length, done = count("done"), missing = count("missing");
  const pct = total ? Math.round(((done + missing) / total) * 100) : 0;
  const qs = (o: Partial<SP>) => "?" + new URLSearchParams(Object.entries({ q: sp.q, s: status, k: sp.k, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const tab = (s: string, label: string, n: number) => (
    <Link href={qs({ s, page: undefined })} className={`rounded-md px-3 py-1.5 text-14 font-medium ${status === s ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
      {label} {n}
    </Link>
  );

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/channel/produk" className="text-14 text-muted-foreground">← Produk Master</Link>
          <h1 className="text-24 font-semibold">Cek SKU</h1>
          <p className="text-14 text-muted-foreground">Cocokkan barang dengan Accurate: tekan <b>Benar</b> kalau saran cocok, atau scan barcode barangnya (Zebra) lalu Enter / <b>Simpan</b>.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {total > 0 && <SkuCheckLoad replace />}
          <SkuCheckPush unpushed={unpushed} />
        </div>
      </div>

      {total === 0 ? (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <p className="text-14">Antrian masih kosong. Upload file hasil cocok Accurate (kolom <b>Cocok</b>: RAGU / TIDAK KETEMU).</p>
          <SkuCheckLoad />
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between text-14">
              <span><b>{done + missing}</b> / {total} barang selesai ({pct}%)</span>
              <span className="text-muted-foreground">{done} ada SKU · {missing} tidak ada di toko</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
          </div>

          <form method="get" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="s" value={status} />
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari nama / merek" className="h-9 min-w-[200px] flex-1 rounded-md border bg-background px-3 text-14" />
            <select name="k" defaultValue={sp.k ?? ""} className="h-9 rounded-md border bg-background px-2 text-14">
              <option value="">Semua</option>
              <option value="RAGU">Ada saran (RAGU)</option>
              <option value="TIDAK">Tidak ketemu</option>
            </select>
            <button className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">Cari</button>
          </form>

          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {tab("pending", "Belum dicek", count("pending"))}
            {tab("done", "Ada SKU", done)}
            {tab("missing", "Tidak ada", missing)}
          </div>

          {pageRows.length === 0 ? (
            <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Tidak ada barang.</p>
          ) : (
            <div className="space-y-2">
              {pageRows.map((g) => {
                const its = g.map((r) => itemById.get(r.itemId)).filter(Boolean) as typeof items;
                const it = its[0];
                const f = g[0];
                return (
                  <SkuCheckCard
                    key={f.groupKey}
                    groupKey={f.groupKey}
                    name={it ? (it.localName ?? it.name) : f.groupKey}
                    variant={it?.variant ?? null}
                    image={its.find((x) => x.image)?.image ?? null}
                    shops={[...new Set(its.map((x) => TOKO[x.platform] ?? x.platform))]}
                    status={f.status}
                    sku={f.sku}
                    saranNama={f.saranNama}
                    saranUpc={f.saranUpc}
                    saranStok={f.saranStok}
                    checkedBy={f.checkedById ? userName.get(f.checkedById) ?? null : null}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-14">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-primary">← Sebelumnya</Link> : <span />}
            <span className="text-muted-foreground">Hal. {page} / {Math.max(1, Math.ceil(shown.length / PER_PAGE))}</span>
            {page * PER_PAGE < shown.length ? <Link href={qs({ page: String(page + 1) })} className="text-primary">Berikutnya →</Link> : <span />}
          </div>

          <details className="rounded-lg border bg-card p-4 text-14">
            <summary className="cursor-pointer font-medium">Tambah dari file lain (antrian lama tetap)</summary>
            <div className="mt-2"><SkuCheckLoad /></div>
          </details>
        </>
      )}
    </div>
  );
}
