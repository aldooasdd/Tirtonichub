// Gudang & Pengiriman tab Shopee: alamat toko & kurir (logistics channel) dari Shopee.
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import { addressList, channelList } from "@/server/marketplace/shopee-logistics";

const TYPE: Record<string, string> = { DEFAULT_ADDRESS: "Utama", PICK_UP_ADDRESS: "Jemput", RETURN_ADDRESS: "Retur", INBOUND_PICKUP_ADDRESS: "Jemput inbound" };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal mengambil data.");

export async function ShopeeGudang() {
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO) return <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sambungkan toko Shopee asli dulu di Kelola Pesanan.</p>;
  const s = await fresh(shop);
  const c = { token: s.accessToken, shopId: s.shopId };
  const [a, ch] = await Promise.allSettled([addressList(c), channelList(c)]);
  const errs = [a, ch].filter((r) => r.status === "rejected").map((r) => errMsg((r as PromiseRejectedResult).reason));
  const addrs = a.status === "fulfilled" ? a.value : [];
  const chans = ch.status === "fulfilled" ? ch.value.sort((x, y) => Number(y.enabled) - Number(x.enabled) || x.name.localeCompare(y.name)) : [];
  return (
    <>
      {errs.map((e) => (
        <p key={e} className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{e}</p>
      ))}
      <section className="space-y-2">
        <h2 className="text-18 font-semibold">Alamat toko ({addrs.length})</h2>
        <ul className="divide-y rounded-lg border bg-card text-14">
          {addrs.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
              <span>{x.text}</span>
              <span className="flex flex-wrap gap-1">
                {x.types.map((t) => (
                  <span key={t} className="rounded bg-orange-500/15 px-1.5 py-0.5 text-12 font-medium text-orange-600">{TYPE[t] ?? t}</span>
                ))}
              </span>
            </li>
          ))}
          {!addrs.length && <li className="p-6 text-center text-muted-foreground">Tidak ada alamat.</li>}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-18 font-semibold">Kurir ({chans.filter((x) => x.enabled).length} aktif dari {chans.length})</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Kurir</th>
                <th className="p-3">Status</th>
                <th className="p-3">COD</th>
                <th className="p-3">Layanan</th>
                <th className="p-3 text-right">Berat maks</th>
              </tr>
            </thead>
            <tbody>
              {chans.map((x) => (
                <tr key={x.id} className={`border-b last:border-b-0 ${x.enabled ? "" : "text-muted-foreground"}`}>
                  <td className="p-3">{x.name}{x.desc && <span className="block text-12 text-muted-foreground">{x.desc}</span>}</td>
                  <td className={`p-3 ${x.enabled ? "font-medium text-emerald-600" : ""}`}>{x.enabled ? "Aktif" : "Mati"}</td>
                  <td className="p-3">{x.cod ? "Bisa" : "-"}</td>
                  <td className="p-3">{x.service || "-"}</td>
                  <td className="p-3 text-right tabular-nums">{x.maxWeight ? `${x.maxWeight} kg` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
