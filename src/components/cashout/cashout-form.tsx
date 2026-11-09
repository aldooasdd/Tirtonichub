"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notaJpeg } from "@/lib/image";
import { CASHOUT_SOURCES, sourceLabel } from "@/lib/cashout-source";
import { scanCashoutNota, saveCashout } from "@/server/actions/cashout";
import { fmtInt, parseInt0 } from "@/lib/money-input";
import { RupiahInput } from "@/components/ui/rupiah-input";

export type CashoutRow = {
  id: string;
  spentAt: string; // sudah diformat
  amount: number;
  description: string;
  category: string | null;
  branch: string;
  source: string;
  approved: boolean;
};
type Branch = { id: string; name: string };

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

type Draft = { amount: number; description: string; spentAt: string; source: string; branchId: string };

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="block text-12 text-muted-foreground">{label}</span>
    {children}
  </label>
);

export function CashoutForm({ rows, categories, branches, defaultBranchId }: { rows: CashoutRow[]; categories: string[]; branches: Branch[]; defaultBranchId: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [category, setCategory] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function onCapture(file: File) {
    setBusy(true);
    setMsg("Memindai nota…");
    try {
      const b64 = await blobToBase64(await notaJpeg(file));
      const r = await scanCashoutNota(b64, "image/jpeg");
      if (!r.ok || !r.photoKey) {
        setMsg(r.message ?? "Gagal pindai.");
        return;
      }
      setPhotoKey(r.photoKey);
      const p = r.parsed!;
      setDraft({ amount: p.amount, description: p.description, spentAt: p.spentAt ? p.spentAt.slice(0, 16) : "", source: "KASIR", branchId: defaultBranchId ?? "" });
      setMsg(r.ocr ? "AI mengisi otomatis. Periksa lalu kirim." : "AI tak terbaca — isi manual.");
    } catch {
      setMsg("File tidak bisa dibaca. Pakai foto JPG/PNG atau PDF.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const upd = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function reset() {
    setDraft(null);
    setPhotoKey(null);
    setMsg("");
  }

  function manual() {
    setDraft({ amount: 0, description: "", spentAt: "", source: "KASIR", branchId: defaultBranchId ?? "" });
    setPhotoKey(null);
    setMsg("Isi manual lalu kirim.");
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    const r = await saveCashout({
      amount: draft.amount,
      description: draft.description,
      spentAt: draft.spentAt || null,
      category,
      source: draft.source,
      branchId: draft.branchId || null,
      photoKey,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message ?? "Gagal simpan.");
      return;
    }
    reset();
    setCategory("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Pembelian</h1>
          <p className="text-14 text-muted-foreground">
            Foto / PDF nota pembelian, AI isi datanya, lalu kirim ke Finance untuk disetujui.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])}
        />
        {!draft && (
          <div className="flex shrink-0 gap-2">
            <Button disabled={busy || !category} onClick={() => fileRef.current?.click()}>
              {busy ? "Memindai…" : "Foto / PDF nota"}
            </Button>
            <Button variant="outline" disabled={busy || !category} onClick={manual}>
              Input manual
            </Button>
          </div>
        )}
      </div>

      {!draft && (
        <div className="max-w-xs space-y-1">
          <span className="block text-12 text-muted-foreground">Jenis pembelian (pilih dulu)</span>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih jenis" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!draft ? (
        msg ? <p className="text-12 text-muted-foreground">{msg}</p> : null
      ) : (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          {msg && <p className="text-12 text-muted-foreground">{msg}</p>}
          <Field label="Jumlah (Rp)">
            <RupiahInput
              inputMode="numeric"
              value={fmtInt(draft.amount)}
              onChange={(e) => upd({ amount: parseInt0(e.target.value) })}
            />
          </Field>
          <Field label="Keterangan">
            <Textarea value={draft.description} onChange={(e) => upd({ description: e.target.value })} rows={2} placeholder="Beli apa / untuk apa" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Uang keluar dari">
              <select value={draft.source} onChange={(e) => upd({ source: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-14">
                {CASHOUT_SOURCES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cabang">
              <select value={draft.branchId} onChange={(e) => upd({ branchId: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-14">
                <option value="">{draft.source === "KASIR" ? "Pilih cabang" : "- (bukan cabang / pusat)"}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {draft.source === "KASIR" ? (
            <p className="text-12 text-muted-foreground">Mengurangi saldo cash laci kasir cabang ini.</p>
          ) : (
            <p className="text-12 text-muted-foreground">Dibayar dari rekening {sourceLabel(draft.source).replace("Bank ", "")}: tidak mengurangi saldo kasir.</p>
          )}
          <Field label="Waktu (opsional)">
            <Input type="datetime-local" value={draft.spentAt} onChange={(e) => upd({ spentAt: e.target.value })} />
          </Field>
          <p className="text-12 text-muted-foreground">Jenis: {category || "-"}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !category || !draft.amount || !draft.description.trim() || (draft.source === "KASIR" && !draft.branchId)} onClick={submit}>
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
                  <p className="truncate font-medium">
                    {rupiah(r.amount)}
                    {r.branch !== "-" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-12 font-normal text-muted-foreground">{r.branch}</span>}
                  </p>
                  <p className="text-11 text-muted-foreground">
                    {r.spentAt}
                    {r.category ? ` · ${r.category}` : ""}
                    {` · ${sourceLabel(r.source)}`}
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
