import { BUCKET_LABEL, type Buckets } from "@/lib/cash";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const KEYS: (keyof Buckets)[] = ["cash", "mandiri", "bca", "bri"];

export function BranchCashBoard({
  opened,
  open,
  masuk,
  cashout,
  expected,
  close,
}: {
  opened: boolean;
  open: Buckets;
  masuk: Buckets;
  cashout: number;
  expected: Buckets;
  close: Buckets | null;
}) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-16 font-semibold">Saldo Kasir Cabang (hari ini)</h2>
        <span className="text-12 text-muted-foreground">
          {opened ? (close ? "Sudah ditutup" : "Berjalan") : "Belum dibuka"}
        </span>
      </div>

      {!opened ? (
        <p className="py-4 text-center text-14 text-muted-foreground">Sales belum buka saldo kasir hari ini.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {KEYS.map((k) => {
              const selisih = close ? close[k] - expected[k] : null;
              return (
                <div key={k} className="rounded-xl border p-3">
                  <p className="text-12 text-muted-foreground">{BUCKET_LABEL[k]}</p>
                  <p className="mt-1 text-16 font-semibold">{rupiah(expected[k])}</p>
                  <p className="text-11 text-muted-foreground">
                    awal {rupiah(open[k])} · masuk {rupiah(masuk[k])}
                    {k === "cash" && cashout > 0 ? ` · keluar ${rupiah(cashout)}` : ""}
                  </p>
                  {close && (
                    <div className="mt-1 text-11">
                      <span className="text-muted-foreground">fisik {rupiah(close[k])}</span>{" "}
                      <span className={selisih === 0 ? "text-emerald-600" : "font-semibold text-destructive"}>
                        {selisih === 0 ? "cocok" : `selisih ${selisih! > 0 ? "+" : ""}${rupiah(selisih!)}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-12 text-muted-foreground">Saldo = saldo awal + uang masuk (penjualan) − pembelian. Angka besar = saldo seharusnya.</p>
        </>
      )}
    </section>
  );
}
