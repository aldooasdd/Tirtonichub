"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image";
import { scanCashoutNota, saveCashout } from "@/server/actions/cashout";

export type CashoutRow = {
  id: string;
  spentAt: string; // sudah diformat
  amount: number;
  description: string;
  branch: string;
  approved: boolean;
};

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

type Draft = { amount: number; description: string; spentAt: string };

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="block text-12 text-muted-foreground">{label}</span>
    {children}
  </label>
);

export function CashoutForm({ rows }: { rows: CashoutRow[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function onCapture(file: File) {
    setBusy(true);
    setMsg("Memindai nota…");
    try {
      const b64 = await blobToBase64(await compressImage(file));
      const r = await scanCashoutNota(b64, "image/jpeg");
      if (!r.ok || !r.photoKey) {
        setMsg(r.message ?? "Gagal pindai.");
        return;
      }
      setPhotoKey(r.photoKey);
      const p = r.parsed!;
      setDraft({ amount: p.amount, description: p.description, spentAt: p.spentAt ? p.spentAt.slice(0, 16) : "" });
      setMsg(r.ocr ? "AI mengisi otomatis. Periksa lalu kirim." : "AI tak terbaca — isi manual.");
    } finally {
      setBusy(false);
    }
  }

  const upd = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function reset() {
    setDraft(null);
    setPhotoKey(null);
    setMsg("");
  }

  async function submit() {
    if (!draft || !photoKey) return;
    setBusy(true);
    const r = await saveCashout({
      amount: draft.amount,
      description: draft.description,
      spentAt: draft.spentAt || null,
      photoKey,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message ?? "Gagal simpan.");
      return;
    }
    reset();
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Pembelian</h1>
          <p className="text-14 text-muted-foreground">
            Foto nota pembelian, AI isi datanya, lalu kirim ke Finance untuk disetujui.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])}
        />
        {!draft && (
          <Button disabled={busy} onClick={() => fileRef.current?.click()} className="shrink-0">
            {busy ? "Memindai…" : "Foto nota pembelian"}
          </Button>
        )}
      </div>

      {!draft ? (
        msg ? <p className="text-12 text-muted-foreground">{msg}</p> : null
      ) : (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          {msg && <p className="text-12 text-muted-foreground">{msg}</p>}
          <Field label="Jumlah (Rp)">
            <Input
              inputMode="numeric"
              value={draft.amount || ""}
              onChange={(e) => upd({ amount: Number(e.target.value.replace(/\D/g, "")) })}
            />
          </Field>
          <Field label="Keterangan">
            <Textarea value={draft.description} onChange={(e) => upd({ description: e.target.value })} rows={2} placeholder="Beli apa / untuk apa" />
          </Field>
          <Field label="Waktu (opsional)">
            <Input type="datetime-local" value={draft.spentAt} onChange={(e) => upd({ spentAt: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !draft.amount || !draft.description.trim()} onClick={submit}>
              {busy ? "Menyimpan…" : "Kirim ke Finance"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={reset}>Batal</Button>
          </div>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-14 font-medium text-muted-foreground">Pembelian terbaru</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border bg-card py-8 text-center text-muted-foreground">Belum ada.</p>
        ) : (
          <div className="rounded-lg border bg-card divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{rupiah(r.amount)}</p>
                  <p className="text-11 text-muted-foreground">
                    {r.spentAt}
                    {r.description ? ` · ${r.description}` : ""}
                  </p>
                </div>
                {!r.approved && (
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-11 font-medium text-warning">
                    Menunggu ACC
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
