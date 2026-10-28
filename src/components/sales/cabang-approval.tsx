"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveSalesReport, rejectSalesReport } from "@/server/actions/sales";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

type Item = { name: string; qty: number; jual: number };
type Row = {
  id: string;
  soldAt: string;
  customer: string;
  salesman: string;
  branch: string;
  by: string;
  grandTotal: number;
  photoKey: string;
  productPhotoKeys?: string[];
  items: Item[];
};

export function CabangApproval({
  pending,
  approveFn = approveSalesReport,
  rejectFn = rejectSalesReport,
  title = "Approval Penjualan",
  desc = "Setujui penjualan offline cabang sebelum masuk Finance.",
}: {
  pending: Row[];
  approveFn?: (id: string) => Promise<{ ok: boolean; message?: string }>;
  rejectFn?: (id: string) => Promise<{ ok: boolean; message?: string }>;
  title?: string;
  desc?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  function act(id: string, fn: (id: string) => Promise<{ ok: boolean; message?: string }>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(id);
    start(async () => {
      const r = await fn(id);
      setBusyId(null);
      if (!r.ok) alert(r.message ?? "Gagal.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">{title}</h1>
        <p className="text-14 text-muted-foreground">{desc}</p>
      </div>

      {pending.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
          Tidak ada penjualan menunggu persetujuan.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map((r) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{rupiah(r.grandTotal)}</p>
                    <p className="text-12 text-muted-foreground">
                      {r.soldAt} · {r.branch} · Sales: {r.salesman} · oleh {r.by}
                    </p>
                    {r.customer !== "-" && <p className="text-12 text-muted-foreground">Pelanggan: {r.customer}</p>}
                  </div>
                  <a
                    href={`/api/file?key=${encodeURIComponent(r.photoKey)}`}
                    target="_blank"
                    rel="noopener"
                    className="text-14 text-primary underline"
                  >
                    Lihat nota
                  </a>
                </div>

                {r.productPhotoKeys && r.productPhotoKeys.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.productPhotoKeys.map((k) => (
                      <a key={k} href={`/api/file?key=${encodeURIComponent(k)}`} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/file?key=${encodeURIComponent(k)}`}
                          alt="Foto produk"
                          className="h-16 w-16 rounded-md border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {r.items.length > 0 && (
                  <div className="rounded-md border">
                    {r.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-14 last:border-b-0">
                        <span className="min-w-0 truncate">{it.name} · {it.qty}×</span>
                        <span className="shrink-0 text-muted-foreground">{rupiah(it.jual)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={busy} onClick={() => act(r.id, approveFn)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => act(r.id, rejectFn, "Tolak & hapus nota ini?")}
                  >
                    <X className="h-4 w-4" /> Tolak
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
