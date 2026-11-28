import { metaAds } from "@/server/meta-ads";

const num = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const uang = (n: number, c: string) => (c === "IDR" ? "Rp " + num(n) : `${num(n)} ${c}`);

/** Tab Iklan → Meta: biaya & hasil iklan Facebook/Instagram per kampanye. */
export async function MetaAdsView({ from, to }: { from: string; to: string }) {
  let d: Awaited<ReturnType<typeof metaAds>>;
  try {
    d = await metaAds(from, to);
  } catch (e) {
    return <p className="rounded-lg border bg-card p-4 text-14 text-destructive">Iklan Meta belum bisa ditarik: {e instanceof Error ? e.message : "gagal"}</p>;
  }
  const t = d.total;
  const kartu: [string, string][] = [
    ["Biaya", uang(t.spend, d.mataUang)],
    ["Jangkauan", num(t.jangkauan)],
    ["Impresi", num(t.impresi)],
    ["Klik link", num(t.klik)],
    ["CPC", t.klik ? uang(t.spend / t.klik, d.mataUang) : "-"],
    ["Chat dimulai", num(t.pesan)],
    ["Pembelian", num(t.beli)],
    ["ROAS", t.spend && t.nilaiBeli ? (t.nilaiBeli / t.spend).toFixed(2) : "-"],
  ];
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2 text-14">
        <input type="hidden" name="p" value="META" />
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">Dari<input type="date" name="from" defaultValue={from} className="h-9 rounded-md border bg-background px-2 text-14 text-foreground" /></label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">Sampai<input type="date" name="to" defaultValue={to} className="h-9 rounded-md border bg-background px-2 text-14 text-foreground" /></label>
        <button className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground">Terapkan</button>
        <span className="text-12 text-muted-foreground">Akun iklan: {d.akun}</span>
      </form>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kartu.map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-card p-3"><p className="text-12 text-muted-foreground">{l}</p><p className="text-20 font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3 font-normal">Kampanye</th>
              <th className="p-3 text-right font-normal">Biaya</th>
              <th className="p-3 text-right font-normal">Jangkauan</th>
              <th className="p-3 text-right font-normal">Klik</th>
              <th className="p-3 text-right font-normal">Chat</th>
              <th className="p-3 text-right font-normal">Beli</th>
              <th className="p-3 text-right font-normal">ROAS</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr:last-child]:border-b-0">
            {d.kampanye.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Tidak ada kampanye berjalan di rentang ini.</td></tr>}
            {d.kampanye.map((k, i) => (
              <tr key={i}>
                <td className="p-3">{k.nama}</td>
                <td className="p-3 text-right tabular-nums">{uang(k.spend, d.mataUang)}</td>
                <td className="p-3 text-right tabular-nums">{num(k.jangkauan)}</td>
                <td className="p-3 text-right tabular-nums">{num(k.klik)}</td>
                <td className="p-3 text-right tabular-nums">{num(k.pesan)}</td>
                <td className="p-3 text-right tabular-nums">{num(k.beli)}</td>
                <td className="p-3 text-right tabular-nums">{k.spend && k.nilaiBeli ? (k.nilaiBeli / k.spend).toFixed(2) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
