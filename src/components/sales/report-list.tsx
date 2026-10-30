import { AlertCircle } from "lucide-react";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

export type ReportRow = {
  id: string;
  soldAt: string;
  grandTotal: number;
  label: string; // jenis kesalahan
  note: string;
  branch: string;
  salesman: string;
  by: string;
  photoKey: string;
};

/** Daftar report salah-input (read-only) untuk role Stok / Finance. Perbaikan dilakukan Kepala Cabang. */
export function ReportList({ rows, title, desc }: { rows: ReportRow[]; title: string; desc: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">{title}</h1>
        <p className="text-14 text-muted-foreground">{desc}</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Tidak ada report.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{rupiah(r.grandTotal)}</p>
                  <p className="text-12 text-muted-foreground">{r.soldAt} · {r.branch} · Sales: {r.salesman} · oleh {r.by}</p>
                </div>
                <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-14 text-primary underline">
                  Lihat nota
                </a>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-13 dark:border-red-900 dark:bg-red-950/30">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <p className="font-medium text-red-600 dark:text-red-400">{r.label}</p>
                  <p className="text-muted-foreground">{r.note}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
