import Link from "next/link";
import { Download } from "lucide-react";
import { requireChannel } from "@/server/auth/rbac";
import { fmtWIB } from "@/lib/datetime";
import { loadTagData, selisih } from "@/server/rfid-data";
import { LepasTag, TagSearch } from "@/components/channel/data-tag";

const PER_PAGE = 50;
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
type SP = { q?: string; st?: string; page?: string };

/** Data Tag: barang yang sudah dipasangi stiker RFID, lengkap sampai kode stikernya. */
export default async function DataTagPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const { all, rows } = await loadTagData(sp);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const q = (sp.q ?? "").trim();
  const qs = (o: Partial<SP>) => "?" + new URLSearchParams(Object.entries({ q, st: sp.st, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const n = (fn: (d: number | null) => boolean) => all.filter((r) => fn(selisih(r))).length;
  const cards: [string, string, number][] = [
    ["", "SKU bertag", all.length],
    ["cocok", "Cocok stok", n((d) => d === 0)],
    ["kurang", "Tag kurang", n((d) => d != null && d < 0)],
    ["lebih", "Tag lebih", n((d) => d != null && d > 0)],
    ["asing", "Tak ada di Produk Master", n((d) => d == null)],
  ];
  const totalTag = all.reduce((x, r) => x + r.tags.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/channel/produk/tag" className="text-14 text-muted-foreground">← Pasangkan Tag</Link>
          <h1 className="text-24 font-semibold">Data Tag</h1>
          <p className="text-14 text-muted-foreground">{totalTag} stiker terpasang di {all.length} SKU. Klik barang untuk lihat kode stikernya.</p>
        </div>
        <a href={`/channel/produk/tag/data/export${qs({})}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-14 font-medium">
          <Download className="size-4" /> Export Excel
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map(([st, label, num]) => (
          <Link key={label} href={qs({ st })} className={`rounded-lg border bg-card p-3 ${(sp.st ?? "") === st ? "border-primary" : ""}`}>
            <p className="text-24 font-semibold tabular-nums">{num}</p>
            <p className="text-12 text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {sp.st && <input type="hidden" name="st" value={sp.st} />}
        <TagSearch value={q} />
        <button className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">Cari</button>
      </form>

      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">{all.length ? "Tidak ada tag yang cocok." : "Belum ada tag terpasang."}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const d = selisih(r);
            const last = r.tags[0];
            return (
              <details key={`${r.key}|${q}`} open={rows.length === 1} className="rounded-lg border bg-card">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
                    <img src={r.image} alt="" className="size-14 shrink-0 rounded-md border object-cover" />
                  ) : (
                    <span className="size-14 shrink-0 rounded-md bg-muted" aria-hidden />
                  )}
                  <span className="min-w-[180px] flex-1">
                    <span className="block font-medium leading-snug">{r.name ?? <span className="text-amber-600">Tidak ada di Produk Master</span>}</span>
                    <span className="block text-12 text-muted-foreground">
                      <span className="font-mono">{r.sku}</span>
                      {r.variant ? ` · ${r.variant}` : ""}
                      {r.price != null ? ` · ${rupiah(r.price)}` : ""}
                    </span>
                    {r.stocks.length > 0 && <span className="block text-12 text-muted-foreground">Stok: {r.stocks.map((s) => `${s.label} ${s.stock}`).join(" · ")}</span>}
                    <span className="block text-12 text-muted-foreground">Terakhir dipasang {fmtWIB(last.at)}{last.by ? ` oleh ${last.by}` : ""}</span>
                  </span>
                  <span className="grid w-full grid-cols-3 gap-4 text-center tabular-nums sm:w-auto">
                    <span><b className="block text-24">{r.tags.length}</b><span className="text-12 text-muted-foreground">tag</span></span>
                    <span><b className="block text-24">{r.stock ?? "–"}</b><span className="text-12 text-muted-foreground">stok</span></span>
                    <span className={d == null ? "" : d === 0 ? "text-emerald-600" : "text-amber-600"}>
                      <b className="block text-24">{d == null ? "–" : d > 0 ? `+${d}` : d}</b>
                      <span className="text-12">{d === 0 ? "cocok" : "selisih"}</span>
                    </span>
                  </span>
                </summary>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-14">
                    <thead>
                      <tr className="text-left text-12 text-muted-foreground">
                        <th className="px-3 py-2">No</th><th className="px-3 py-2">Kode stiker</th><th className="px-3 py-2">Dipasang</th><th className="px-3 py-2">Oleh</th><th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {r.tags.map((t, i) => (
                        <tr key={t.epc} className={`border-t ${q && t.epc.toLowerCase().includes(q.toLowerCase()) ? "bg-amber-500/10" : ""}`}>
                          <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-12">{t.epc}</td>
                          <td className="whitespace-nowrap px-3 py-2">{fmtWIB(t.at)}</td>
                          <td className="px-3 py-2">{t.by ?? "-"}</td>
                          <td className="px-3 py-2 text-right"><LepasTag epc={t.epc} sku={r.sku} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-14">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-primary">← Sebelumnya</Link> : <span />}
          <span className="text-muted-foreground">Hal. {page} / {pages}</span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })} className="text-primary">Berikutnya →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
