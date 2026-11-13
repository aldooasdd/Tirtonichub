"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, ScanLine, Send, Undo2, X } from "lucide-react";
import { confirmSaran, loadSkuCheckFile, markMissing, pushCheckedSkus, reopenCheck, setScannedSku } from "@/server/actions/sku-check";

type Res = { ok: boolean; message?: string };
const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  return { pending, msg, run };
}

export function SkuCheckCard(p: {
  groupKey: string; name: string; variant: string | null; image: string | null; shops: string[];
  status: string; sku: string | null; saranNama: string | null; saranUpc: string | null; saranStok: number | null; checkedBy: string | null;
}) {
  const { pending, msg, run } = useRun();
  const [scan, setScan] = useState("");
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-14 font-medium disabled:opacity-40";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex gap-3">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN marketplace
          <img src={p.image} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
        ) : (
          <span className="size-16 shrink-0 rounded-md bg-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{p.name}</p>
          <p className="text-12 text-muted-foreground">{p.variant ? `${p.variant} · ` : ""}{p.shops.join(", ")}</p>
          {p.saranNama ? (
            <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-12">
              Saran Accurate: <b>{p.saranNama}</b>
              {p.saranUpc ? <> · UPC <span className="font-mono">{p.saranUpc}</span></> : " · tanpa UPC"}
              {p.saranStok != null ? ` · stok ${p.saranStok}` : ""}
            </p>
          ) : (
            p.status === "pending" && <p className="mt-1 text-12 text-muted-foreground">Tidak ketemu di Accurate — scan barcode barangnya.</p>
          )}
        </div>
      </div>

      {p.status === "pending" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.saranUpc && (
            <button type="button" disabled={pending} onClick={() => run(() => confirmSaran(p.groupKey))} className={`${btn} border-emerald-600 bg-emerald-600 text-white`}>
              <Check className="size-4" /> Benar
            </button>
          )}
          <form
            className="flex min-w-[220px] flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (scan.trim()) run(() => setScannedSku(p.groupKey, scan));
            }}
          >
            <ScanLine className="size-4 shrink-0 text-muted-foreground" />
            <input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan barcode / ketik SKU" aria-label="SKU" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-14" />
            <button type="submit" disabled={pending || !scan.trim()} className={`${btn} border-primary bg-primary text-primary-foreground`}>
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
          <button type="button" disabled={pending} onClick={() => run(() => markMissing(p.groupKey))} className={`${btn} text-destructive`}>
            <X className="size-4" /> Tidak ada di toko
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-12">
          <span className={p.status === "done" ? "text-emerald-600" : "text-destructive"}>
            {p.status === "done" ? <>SKU <span className="font-mono font-semibold">{p.sku}</span></> : "Tidak ada di toko"}
            {p.checkedBy ? ` · dicek ${p.checkedBy}` : ""}
          </span>
          <button type="button" disabled={pending} onClick={() => run(() => reopenCheck(p.groupKey))} className="inline-flex items-center gap-1 text-muted-foreground disabled:opacity-40">
            <Undo2 className="size-3.5" /> Cek ulang
          </button>
        </div>
      )}
      {msg && <p className={`mt-1 text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}

/** replace = Ganti file: antrian "belum dicek" lama dibuang, diganti isi file baru. */
export function SkuCheckLoad({ replace = false }: { replace?: boolean }) {
  const { pending, msg, run } = useRun();
  return (
    <div className="space-y-1">
      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-14 font-medium">
        <FileUp className="size-4" /> {pending ? "Memuat…" : replace ? "Ganti file" : "Upload file hasil cocok Accurate (.xlsx)"}
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (replace && !confirm(`Ganti antrian dengan "${f.name}"? Barang yang belum dicek diganti isi file ini. Yang sudah dicek tetap.`)) return;
            run(async () => loadSkuCheckFile(await toBase64(f), replace));
          }}
        />
      </label>
      {msg && <p className={`text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}

export function SkuCheckPush({ unpushed }: { unpushed: number }) {
  const { pending, msg, run } = useRun();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending || unpushed === 0}
        onClick={() => confirm(`Kirim ${unpushed} SKU hasil cek ke Shopee & Tokopedia sekarang?`) && run(() => pushCheckedSkus())}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-40"
      >
        <Send className="size-4" /> {pending ? "Mengirim…" : `Kirim ke marketplace (${unpushed})`}
      </button>
      {msg && <p className={`max-w-xs text-right text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
