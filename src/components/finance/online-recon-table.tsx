"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnlineRecon } from "@/server/actions/online-recon";
import { fmtInt, parseInt0 } from "@/lib/money-input";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

export type OnlineReconRow = {
  channel: string;
  label: string;
  actual: number | null; // null = belum diisi
  note: string;
  cair: number | null; // dana cair otomatis dari marketplace bulan ini (null = tak ada data)
};

/** Dompet online: saldo per kanal per bulan, diisi & disimpan Finance. */
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

  const total = rows.reduce((s, r) => s + (r.actual ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => {
          const d = draft[r.channel];
          return (
            <div key={r.channel} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{r.label}</h2>
                <span className="text-12 text-muted-foreground">{r.actual == null ? "Belum diisi" : rupiah(r.actual)}</span>
              </div>
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Saldo (Rp)</span>
                <input
                  inputMode="numeric"
                  value={fmtInt(d.actual)}
                  onChange={(e) => setDraft({ ...draft, [r.channel]: { ...d, actual: parseInt0(e.target.value) } })}
                  placeholder="0"
                  className="h-9 w-full rounded-md border bg-background px-2 text-right text-14"
                />
              </label>
              {r.cair != null && (
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-12">
                  <span>
                    Dana cair otomatis: <b className="tabular-nums">{rupiah(r.cair)}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, [r.channel]: { ...d, actual: r.cair ?? 0 } })}
                    className="rounded border bg-card px-2 py-0.5 font-medium"
                  >
                    Pakai
                  </button>
                </div>
              )}
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Catatan</span>
                <textarea
                  value={d.note}
                  onChange={(e) => setDraft({ ...draft, [r.channel]: { ...d, note: e.target.value } })}
                  rows={3}
                  className="w-full rounded-md border bg-background px-2 py-1 text-14"
                />
              </label>
              <button
                type="button"
                onClick={() => save(r.channel)}
                disabled={pending}
                className="h-9 w-full rounded-md bg-primary px-3 text-14 font-medium text-primary-foreground disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <span className="font-semibold">Total dompet {month}</span>
        <span className="text-24 font-semibold tabular-nums">{rupiah(total)}</span>
      </div>
      {msg && <p className={msg === "Tersimpan." ? "text-14 text-emerald-600" : "text-14 text-destructive"}>{msg}</p>}
    </div>
  );
}
