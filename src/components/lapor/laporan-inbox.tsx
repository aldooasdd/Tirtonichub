"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveReport } from "@/server/actions/reports";

type Row = {
  id: string;
  message: string;
  photoKey: string | null;
  by: string;
  at: string;
  resolved: boolean;
};

export function LaporanInbox({ reports }: { reports: Row[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function done(id: string) {
    start(async () => {
      const r = await resolveReport(id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Laporan Masuk</h1>
      {reports.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada laporan.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className={`rounded-lg border bg-card p-4 ${r.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-12 text-muted-foreground">{r.at} · {r.by}</p>
                  <p className="mt-1 whitespace-pre-wrap text-14">{r.message}</p>
                </div>
                {r.resolved ? (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-11 font-medium text-emerald-600">Selesai</span>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => done(r.id)} className="shrink-0">
                    Tandai selesai
                  </Button>
                )}
              </div>
              {r.photoKey && (
                <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="mt-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/file?key=${encodeURIComponent(r.photoKey)}`} alt="Screenshot" className="h-28 rounded-md border object-cover" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
