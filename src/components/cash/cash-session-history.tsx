"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { CashSessionRow, Buckets } from "@/lib/cash";
import { updateCashSession } from "@/server/actions/cash";
import { fmtInt, parseInt0 } from "@/lib/money-input";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const total = (b: Buckets) => b.cash + b.mandiri + b.bca + b.bri;
const jam = (d: Date) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(d));
const tgl = (d: Date) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(d));

/** Saldo total + rincian isian kasir (cash laci & tiap EDC) di bawahnya. */
function Saldo({ b }: { b: Buckets }) {
  return (
    <>
      <div className="font-semibold">{rupiah(total(b))}</div>
      <div className="flex flex-wrap justify-end gap-x-2 text-12 font-normal text-muted-foreground">
        <span>Cash {rupiah(b.cash)}</span>
        <span>Mandiri {rupiah(b.mandiri)}</span>
        <span>BCA {rupiah(b.bca)}</span>
        <span>BRI {rupiah(b.bri)}</span>
      </div>
    </>
  );
}

const KEYS = [
  ["cash", "Cash"],
  ["mandiri", "Mandiri"],
  ["bca", "BCA"],
  ["bri", "BRI"],
] as const;

/** Finance: koreksi saldo buka (+ tutup bila sudah ditutup). */
function EditRow({ r, onDone }: { r: CashSessionRow; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState("");
  const [open, setOpen] = React.useState(() => Object.fromEntries(KEYS.map(([k]) => [k, fmtInt(r.open[k])])) as Record<keyof Buckets, string>);
  const [close, setClose] = React.useState(() => Object.fromEntries(KEYS.map(([k]) => [k, fmtInt(r.close?.[k] ?? 0)])) as Record<keyof Buckets, string>);
  const num = (v: Record<keyof Buckets, string>): Buckets => ({ cash: parseInt0(v.cash), mandiri: parseInt0(v.mandiri), bca: parseInt0(v.bca), bri: parseInt0(v.bri) });
  const inputs = (v: Record<keyof Buckets, string>, set: (x: Record<keyof Buckets, string>) => void) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {KEYS.map(([k, label]) => (
        <label key={k} className="flex flex-col gap-1 text-12 text-muted-foreground">
          {label}
          <input inputMode="numeric" value={v[k]} onChange={(e) => set({ ...v, [k]: fmtInt(e.target.value) })} className="h-8 rounded-md border bg-background px-2 text-right text-14 text-foreground tabular-nums" />
        </label>
      ))}
    </div>
  );
  return (
    <tr>
      <td colSpan={8} className="pb-3">
        <form
          className="space-y-3 rounded-lg border bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setErr("");
            start(async () => {
              const res = await updateCashSession(r.id, num(open), r.closeAt ? num(close) : null).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
              if (!res.ok) return setErr(res.message ?? "Gagal.");
              onDone();
              router.refresh();
            });
          }}
        >
          <div>
            <p className="mb-1 text-12 font-semibold">Saldo buka</p>
            {inputs(open, setOpen)}
          </div>
          {r.closeAt && (
            <div>
              <p className="mb-1 text-12 font-semibold">Saldo tutup</p>
              {inputs(close, setClose)}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {err && <span className="mr-auto text-12 text-destructive">{err}</span>}
            <button type="button" onClick={onDone} className="h-8 px-3 text-12 text-muted-foreground">
              Batal
            </button>
            <button type="submit" disabled={pending} className="h-8 rounded-md bg-primary px-3 text-12 font-medium text-primary-foreground disabled:opacity-50">
              {pending ? "Menyimpan…" : "Simpan koreksi"}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

const PREVIEW = 3; // baris per cabang sebelum "lihat semua"

export function CashSessionHistory({ rows }: { rows: CashSessionRow[] }) {
  const [all, setAll] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);

  // Kelompokkan per cabang, urutan cabang ikut kemunculan pertama (terbaru dulu sudah dari loader).
  const groups = new Map<string, { name: string; rows: CashSessionRow[] }>();
  for (const r of rows) {
    const g = groups.get(r.branchId) ?? { name: r.branch, rows: [] };
    g.rows.push(r);
    groups.set(r.branchId, g);
  }
  const branches = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h2 className="text-14 font-semibold">Riwayat Buka / Tutup Kasir</h2>
      <p className="text-12 text-muted-foreground">Per cabang · buka wakil shift pertama, tutup wakil shift terakhir</p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-14 text-muted-foreground">Belum ada data buka kasir.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          {branches.map((b) => {
            const shown = all ? b.rows : b.rows.slice(0, PREVIEW);
            return (
              <div key={b.name}>
                <h3 className="text-13 font-semibold text-muted-foreground">{b.name}</h3>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full border-collapse text-14 [&_td]:px-3 [&_th]:px-3 [&_td:first-child]:pl-0 [&_th:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th:last-child]:pr-0">
                    <thead>
                      <tr className="text-12 text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Tgl</th>
                        <th className="pb-2 text-left font-medium">Buka</th>
                        <th className="pb-2 text-left font-medium">Oleh</th>
                        <th className="pb-2 text-right font-medium">Saldo buka</th>
                        <th className="pb-2 text-left font-medium">Tutup</th>
                        <th className="pb-2 text-left font-medium">Oleh</th>
                        <th className="pb-2 text-right font-medium">Saldo tutup</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <React.Fragment key={r.id}>
                        <tr className="border-t align-top">
                          <td className="py-2 whitespace-nowrap text-muted-foreground">{tgl(r.date)}</td>
                          <td className="py-2 whitespace-nowrap text-emerald-600">{jam(r.openAt)}</td>
                          <td className="py-2">{r.openBy}</td>
                          <td className="py-2 text-right"><Saldo b={r.open} /></td>
                          {r.closeAt ? (
                            <>
                              <td className="py-2 whitespace-nowrap text-destructive">{jam(r.closeAt)}</td>
                              <td className="py-2">{r.closeBy}</td>
                              <td className="py-2 text-right"><Saldo b={r.close!} /></td>
                            </>
                          ) : (
                            <td className="py-2 text-amber-600" colSpan={3}>Belum ditutup</td>
                          )}
                          <td className="py-2 text-right">
                            <button type="button" aria-label="Ubah saldo" title="Ubah saldo (Finance)" onClick={() => setEditing(editing === r.id ? null : r.id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <Pencil className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                        {editing === r.id && <EditRow r={r} onDone={() => setEditing(null)} />}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {branches.some((b) => b.rows.length > PREVIEW) && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="w-full rounded-lg border py-2 text-12 font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {all ? "Tampilkan lebih sedikit" : "Lihat semua"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
