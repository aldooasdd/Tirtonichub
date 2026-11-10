import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
  reporter: string; // pelapor salah-input
  photoKey: string;
  reportedAt: string;
  resolvedAt: string | null; // null = masih terbuka
};

/** Daftar report salah-input (read-only) untuk role Stok / Finance. Perbaikan dilakukan Kepala Cabang. */
export function ReportList({ rows, title, desc, href, done, open }: { rows: ReportRow[]; title: string; desc: string; href: string; done: boolean; open: number }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">{title}</h1>
        <p className="text-14 text-muted-foreground">{desc}</p>
      </div>
      <nav className="flex gap-2">
        <Link href={href} className={`rounded-md px-3 py-1.5 text-14 font-medium ${!done ? "bg-red-500/15 text-red-600" : "border text-muted-foreground"}`}>
          Terbuka ({open})
        </Link>
        <Link href={`${href}?s=selesai`} className={`rounded-md px-3 py-1.5 text-14 font-medium ${done ? "bg-emerald-500/15 text-emerald-600" : "border text-muted-foreground"}`}>
          Sudah selesai
        </Link>
      </nav>

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
                {r.photoKey ? (
                  <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-14 text-primary underline">
                    Lihat nota
                  </a>
                ) : (
                  <span className="text-14 text-muted-foreground">Kasir POS</span>
                )}
              </div>
              <div
                className={`flex items-start gap-2 rounded-md border p-3 text-13 ${r.resolvedAt ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"}`}
              >
                {r.resolvedAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                <div className="min-w-0">
                  <p className={`font-medium ${r.resolvedAt ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{r.label}</p>
                  <p className="text-muted-foreground">{r.note}</p>
                  <p className="mt-1 text-12 text-muted-foreground">
                    Dilaporkan oleh {r.reporter} · {r.reportedAt}
                    {r.resolvedAt && ` · selesai ${r.resolvedAt}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
