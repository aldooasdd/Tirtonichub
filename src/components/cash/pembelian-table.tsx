"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCashoutChecked } from "@/server/actions/cashout";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

export type PembelianRow = {
  id: string;
  tgl: string;
  category: string;
  branch: string;
  description: string;
  by: string;
  amount: number;
  photoKey: string | null;
  checked: boolean;
  checkedBy: string | null;
};

export function PembelianTable({ rows }: { rows: PembelianRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggle(id: string, next: boolean) {
    setBusyId(id);
    start(async () => {
      const r = await toggleCashoutChecked(id, next);
      setBusyId(null);
      if (!r.ok) alert(r.message ?? "Gagal.");
      else router.refresh();
    });
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const checkedCount = rows.filter((r) => r.checked).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-24 font-semibold">Rekap Pembelian</h1>
        <p className="text-14 text-muted-foreground">
          Dicek {checkedCount}/{rows.length} · Total: <span className="font-semibold text-foreground">{rupiah(total)}</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada pembelian.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b bg-card text-left text-muted-foreground">
                <th className="p-3">Cek</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Cabang</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3">Oleh</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b last:border-b-0 ${r.checked ? "bg-emerald-500/5" : ""}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={r.checked}
                      disabled={pending && busyId === r.id}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                      title={r.checked && r.checkedBy ? `Dicek oleh ${r.checkedBy}` : "Tandai sudah dicek"}
                      className="h-4 w-4 cursor-pointer accent-emerald-600"
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.tgl}</td>
                  <td className="p-3">{r.category}</td>
                  <td className="p-3">{r.branch}</td>
                  <td className="p-3">{r.description}</td>
                  <td className="p-3">{r.by}</td>
                  <td className="p-3 text-right font-medium whitespace-nowrap">{rupiah(r.amount)}</td>
                  <td className="p-3">
                    {r.photoKey ? (
                      <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-primary">
                        Lihat
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
