"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approveCashout, rejectCashout } from "@/server/actions/cashout";

type Row = {
  id: string;
  spentAt: string;
  amount: number;
  description: string;
  branch: string;
  by: string;
  photoKey: string | null;
};

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

export function CashoutApproval({ pending }: { pending: Row[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function act(id: string, approve: boolean) {
    if (!approve && !confirm("Tolak & hapus pengeluaran ini?")) return;
    start(async () => {
      const r = await (approve ? approveCashout(id) : rejectCashout(id));
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Approval Pembelian</h1>
      <div className="flex flex-col gap-3">
        {pending.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Tidak ada pengeluaran menunggu.</p>
        )}
        {pending.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{rupiah(r.amount)}</p>
                <p className="text-14 text-muted-foreground">
                  {r.spentAt} · {r.branch} · {r.by}
                </p>
              </div>
              {r.photoKey && (
                <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-14 text-primary">
                  Lihat nota
                </a>
              )}
            </div>
            <p className="mt-2 text-14">{r.description}</p>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => act(r.id, true)}>
                Setujui
              </Button>
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => act(r.id, false)}>
                Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
