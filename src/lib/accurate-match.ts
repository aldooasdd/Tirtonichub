// Cocokkan faktur Accurate dengan rekap penjualan. "Semua cocok" = no nota +
// tanggal + total semuanya sama. Murni (tanpa DB) supaya bisa diuji.

export type AccSale = { notaNo: string | null; date: string | null; customer: string | null; total: number };
export type AppRep = { id: string; notaNo: string | null; dateKey: string | null; grandTotal: number; customer: string | null };

export type Row = { notaNo: string | null; date: string | null; customer: string | null; total: number };
export type Selisih = { notaNo: string | null; accDate: string | null; accTotal: number; appDate: string | null; appTotal: number };

export type Reconcile = {
  cocok: Row[];
  selisih: Selisih[];
  hanyaAccurate: Row[];
  hanyaRekap: Row[];
  marks: { id: string; ref: string }[]; // SalesReport yang ditandai tersinkron
};

const normNota = (s: string | null) => (s ?? "").toUpperCase().replace(/\s+/g, "").trim();

export function reconcile(acc: AccSale[], app: AppRep[]): Reconcile {
  const byNota = new Map<string, AppRep[]>();
  for (const a of app) {
    const k = normNota(a.notaNo);
    if (!k) continue;
    (byNota.get(k) ?? byNota.set(k, []).get(k)!).push(a);
  }

  const matched = new Set<string>();
  const used = new Set<string>(); // app yg sudah "terpakai" (cocok / selisih) → jangan masuk hanyaRekap
  const cocok: Row[] = [];
  const selisih: Selisih[] = [];
  const hanyaAccurate: Row[] = [];
  const marks: { id: string; ref: string }[] = [];

  for (const s of acc) {
    const k = normNota(s.notaNo);
    const cand = k ? byNota.get(k) ?? [] : [];
    if (cand.length === 0) {
      hanyaAccurate.push({ notaNo: s.notaNo, date: s.date, customer: s.customer, total: s.total });
      continue;
    }
    const full = cand.find((a) => !matched.has(a.id) && a.dateKey === s.date && a.grandTotal === s.total);
    if (full) {
      matched.add(full.id);
      used.add(full.id);
      marks.push({ id: full.id, ref: s.notaNo ?? "" });
      cocok.push({ notaNo: s.notaNo, date: s.date, customer: s.customer, total: s.total });
    } else {
      const c = cand.find((a) => !used.has(a.id)) ?? cand[0];
      used.add(c.id);
      selisih.push({ notaNo: s.notaNo, accDate: s.date, accTotal: s.total, appDate: c.dateKey, appTotal: c.grandTotal });
    }
  }

  // hanya di rekap: app yang tak tercocok, dibatasi rentang tanggal Accurate.
  const dates = acc.map((a) => a.date).filter((d): d is string => !!d).sort();
  const lo = dates[0];
  const hi = dates[dates.length - 1];
  const hanyaRekap: Row[] = app
    .filter((a) => !used.has(a.id))
    .filter((a) => !lo || !hi || (a.dateKey != null && a.dateKey >= lo && a.dateKey <= hi))
    .map((a) => ({ notaNo: a.notaNo, date: a.dateKey, customer: a.customer, total: a.grandTotal }));

  return { cocok, selisih, hanyaAccurate, hanyaRekap, marks };
}
