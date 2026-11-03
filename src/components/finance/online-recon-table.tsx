"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnlineRecon } from "@/server/actions/online-recon";
import { fmtInt, parseInt0 } from "@/lib/money-input";

const rupiah = (n: number) => (n < 0 ? "−" : "") + "Rp " + new Intl.NumberFormat("id-ID").format(Math.abs(n));

export type OnlineReconRow = {
  channel: string;
  label: string;
  appTotal: number;
  notaCount: number;
  actual: number | null; // null = belum diisi
  note: string;
};

export function OnlineReconTable({ month, rows }: { month: string; rows: OnlineReconRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.map((r) => [r.channel, { actual: r.actual ?? 0, note: r.note }])));
  const [msg, setMsg] = useState<string | null>(null);

  function save(channel: string) {
    const d = draft[channel];
    setMsg(null);
    start(async () => {
      const r = await saveOnlineRecon(month, channel, d.actual, d.note).catch(() => ({ ok: false, message: "Gagal simpan. Muat ulang halaman lalu coba lagi." }));
      setMsg(r.ok ? "Tersimpan." : r.message ?? "Gagal simpan.");
      if (r.ok) router.refresh();
    });
  }

  const sumApp = rows.reduce((s, r) => s + r.appTotal, 0);
  const filled = rows.filter((r) => r.actual != null);
  const sumActual = filled.reduce((s, r) => s + (r.actual ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b bg-card text-left text-muted-foreground">
              <th className="p-3">Kanal</th>
              <th className="p-3 text-right">Total di app</th>
              <th className="p-3">Uang asli</th>
              <th className="p-3 text-right">Selisih</th>
              <th className="p-3">Catatan</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = draft[r.channel];
              const diff = r.actual == null ? null : r.actual - r.appTotal;
              return (
                <tr key={r.channel} className="border-b align-top last:border-b-0">
                  <td className="p-3 font-medium">{r.label}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="font-medium tabular-nums">{rupiah(r.appTotal)}</div>
                    <div className="text-12 text-muted-foreground">{r.notaCount} nota</div>
                  </td>
                  <td className="p-3">
                    <input
                      inputMode="numeric"
                      value={fmtInt(d.actual)}
                      onChange={(e) => setDraft({ ...draft, [r.channel]: { ...d, actual: parseInt0(e.target.value) } })}
                      placeholder="0"
                      aria-label={`Uang asli ${r.label}`}
                      className="h-9 w-36 rounded-md border bg-background px-2 text-right text-14"
                    />
                  </td>
                  <td className="p-3 text-right font-medium whitespace-nowrap tabular-nums">
                    {diff == null ? (
                      <span className="text-muted-foreground">Belum diisi</span>
                    ) : (
                      <span className={diff === 0 ? "text-emerald-600" : "text-destructive"}>{diff === 0 ? "Cocok" : rupiah(diff)}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <input
                      value={d.note}
                      onChange={(e) => setDraft({ ...draft, [r.channel]: { ...d, note: e.target.value } })}
                      placeholder="mis. potongan admin marketplace"
                      aria-label={`Catatan ${r.label}`}
                      className="h-9 w-full min-w-48 rounded-md border bg-background px-2 text-14"
                    />
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => save(r.channel)} disabled={pending} className="h-9 rounded-md bg-primary px-3 text-14 font-medium text-primary-foreground disabled:opacity-50">
                      Simpan
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-card font-semibold">
              <td className="p-3">Total</td>
              <td className="p-3 text-right tabular-nums">{rupiah(sumApp)}</td>
              <td className="p-3 tabular-nums">{filled.length ? rupiah(sumActual) : "-"}</td>
              <td className="p-3 text-right tabular-nums">
                {filled.length === rows.length ? (
                  <span className={sumActual - sumApp === 0 ? "text-emerald-600" : "text-destructive"}>
                    {sumActual - sumApp === 0 ? "Cocok" : rupiah(sumActual - sumApp)}
                  </span>
                ) : (
                  <span className="text-12 font-normal text-muted-foreground">isi semua kanal</span>
                )}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {msg && <p className={msg === "Tersimpan." ? "text-14 text-emerald-600" : "text-14 text-destructive"}>{msg}</p>}
      <p className="text-12 text-muted-foreground">
        Total di app = jumlah pembayaran metode SHOPEE / TOKOPEDIA / WEBSITE dari nota yang sudah di-ACC, berdasarkan tanggal nota.
      </p>
    </div>
  );
}
