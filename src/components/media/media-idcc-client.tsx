"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runIdccAnalysis, createIdccContent } from "@/server/actions/media-idcc";

type Row = { id: string; nama: string; rekomendasi: string; prioritas: number; alasan: string; ide_konten: string };

const REK_TYPES: Record<string, string[]> = { video: ["idc"], foto: ["idf"], keduanya: ["idf", "idc"], pantau: [] };

const REK: Record<string, { label: string; cls: string }> = {
  video: { label: "Video", cls: "bg-purple-100 text-purple-800" },
  foto: { label: "Foto", cls: "bg-blue-100 text-blue-800" },
  keduanya: { label: "Foto + Video", cls: "bg-indigo-100 text-indigo-800" },
  pantau: { label: "Pantau", cls: "bg-muted text-muted-foreground" },
};
const PRIO: Record<number, string> = { 1: "Minggu ini", 2: "2 minggu", 3: "Bisa menunggu" };

export function MediaIdccClient({ canRun, summary, reportAt, rows }: { canRun: boolean; summary: string | null; reportAt: string | null; rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const r = await runIdccAnalysis();
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }
  function makeContent(row: Row) {
    const types = REK_TYPES[row.rekomendasi] ?? [];
    if (!types.length) return;
    start(async () => {
      const r = await createIdccContent(row.id, types);
      alert(r.ok ? "Konten IDCC dibuat & dijadwalkan." : r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-24 font-semibold">Analisis IDCC</h1>
          <p className="text-14 text-muted-foreground">AI menilai stok lama (stok banyak & umur lama) → saran konten untuk membantu menjualnya.</p>
        </div>
        {canRun && (
          <Button disabled={pending} onClick={run}>{pending ? "Menganalisis…" : "Jalankan analisis AI"}</Button>
        )}
      </div>

      {!canRun && <p className="rounded-lg border bg-card p-4 text-muted-foreground">Akun ini belum diberi izin Analisis IDCC.</p>}

      {summary && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-1 text-12 text-muted-foreground">Ringkasan{reportAt ? ` · ${reportAt}` : ""}</p>
          <p className="text-14">{summary}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada hasil analisis. Jalankan analisis AI.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{r.nama}</p>
                <span className={`rounded px-1.5 py-0.5 text-11 ${REK[r.rekomendasi]?.cls ?? "bg-muted"}`}>{REK[r.rekomendasi]?.label ?? r.rekomendasi}</span>
                <Badge variant={r.prioritas === 1 ? "default" : "secondary"}>P{r.prioritas} · {PRIO[r.prioritas]}</Badge>
              </div>
              <p className="mt-1 text-13 text-muted-foreground">{r.alasan}</p>
              <p className="mt-1 text-13"><span className="text-muted-foreground">Ide: </span>{r.ide_konten}</p>
              {canRun && (REK_TYPES[r.rekomendasi]?.length ?? 0) > 0 && (
                <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => makeContent(r)}>
                  Buat konten IDCC
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
