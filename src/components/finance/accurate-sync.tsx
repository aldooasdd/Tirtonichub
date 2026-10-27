"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Check, AlertTriangle, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAccurate, type SyncResult } from "@/server/actions/accurate";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

type Report = NonNullable<SyncResult["report"]>;

export function AccurateSync() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function onPick(file: File) {
    setBusy(true);
    setMsg(null);
    setReport(null);
    try {
      const b64 = await fileToBase64(file);
      const r = await syncAccurate(b64);
      if (!r.ok || !r.report) {
        setMsg(r.message ?? "Gagal sinkronisasi.");
        return;
      }
      setReport(r.report);
      setMsg(`${r.report.totalAccurate} faktur Accurate dibaca · ${r.report.markedCount} cocok & ditandai.`);
    } catch {
      setMsg("Gagal proses PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Sinkronisasi Accurate</h1>
          <p className="text-14 text-muted-foreground">
            Upload PDF penjualan dari Accurate. AI membacanya lalu dicocokkan dengan Rekap Penjualan (no nota + tanggal + total).
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <Button disabled={busy} onClick={() => fileRef.current?.click()} className="shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload PDF Accurate
        </Button>
      </div>

      {msg && <p className="rounded-lg border bg-card p-3 text-14 text-muted-foreground">{msg}</p>}

      {report && (
        <div className="space-y-4">
          <Section
            icon={<Check className="h-4 w-4 text-success" />}
            title={`Cocok (${report.cocok.length})`}
            empty="Belum ada yang cocok."
            rows={report.cocok.map((r) => ({ a: r.notaNo ?? "-", b: `${r.date ?? "-"}${r.customer ? ` · ${r.customer}` : ""}`, c: rupiah(r.total) }))}
          />
          <Section
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
            title={`Selisih (${report.selisih.length})`}
            hint="No nota sama, tapi tanggal/total beda."
            empty="Tak ada selisih."
            rows={report.selisih.map((r) => ({
              a: r.notaNo ?? "-",
              b: `Accurate: ${r.accDate ?? "-"} · ${rupiah(r.accTotal)}`,
              c: `Rekap: ${r.appDate ?? "-"} · ${rupiah(r.appTotal)}`,
            }))}
          />
          <Section
            icon={<FileWarning className="h-4 w-4 text-destructive" />}
            title={`Hanya di Accurate (${report.hanyaAccurate.length})`}
            hint="Ada di Accurate, belum ada di Rekap."
            empty="Tak ada."
            rows={report.hanyaAccurate.map((r) => ({ a: r.notaNo ?? "-", b: `${r.date ?? "-"}${r.customer ? ` · ${r.customer}` : ""}`, c: rupiah(r.total) }))}
          />
          <Section
            icon={<FileWarning className="h-4 w-4 text-muted-foreground" />}
            title={`Hanya di Rekap (${report.hanyaRekap.length})`}
            hint="Ada di Rekap, tak ada di Accurate (dalam rentang tanggal PDF)."
            empty="Tak ada."
            rows={report.hanyaRekap.map((r) => ({ a: r.notaNo ?? "-", b: `${r.date ?? "-"}${r.customer ? ` · ${r.customer}` : ""}`, c: rupiah(r.total) }))}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  empty,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  empty: string;
  rows: { a: string; b: string; c: string }[];
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        {icon}
        <span className="text-14 font-medium">{title}</span>
        {hint && <span className="text-12 text-muted-foreground">· {hint}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-13 text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2 text-14">
              <span className="font-medium">{r.a}</span>
              <span className="text-12 text-muted-foreground">{r.b}</span>
              <span className="text-13">{r.c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
