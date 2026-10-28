"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openCashSession, closeCashSession } from "@/server/actions/cash";

type Amounts = { cash: number; mandiri: number; bca: number; bri: number };
const empty: Amounts = { cash: 0, mandiri: 0, bca: 0, bri: 0 };
const FIELDS: { key: keyof Amounts; label: string }[] = [
  { key: "cash", label: "Cash di laci" },
  { key: "mandiri", label: "EDC Mandiri" },
  { key: "bca", label: "EDC BCA" },
  { key: "bri", label: "EDC BRI" },
];

function AmountGrid({ v, set }: { v: Amounts; set: (a: Amounts) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FIELDS.map((f) => (
        <label key={f.key} className="space-y-1">
          <span className="block text-12 text-muted-foreground">{f.label}</span>
          <Input
            inputMode="numeric"
            value={v[f.key] || ""}
            onChange={(e) => set({ ...v, [f.key]: Number(e.target.value.replace(/\D/g, "")) })}
          />
        </label>
      ))}
    </div>
  );
}

export function CashOpenForm() {
  const router = useRouter();
  const [v, setV] = useState<Amounts>(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit() {
    setBusy(true);
    const r = await openCashSession(v);
    setBusy(false);
    if (!r.ok) return setMsg(r.message ?? "Gagal.");
    router.refresh();
  }
  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
      <div>
        <h2 className="text-16 font-semibold">Buka Saldo Kasir</h2>
        <p className="text-12 text-muted-foreground">Input saldo awal laci + EDC sebelum mulai. Wajib (sekali per cabang/hari).</p>
      </div>
      <AmountGrid v={v} set={setV} />
      {msg && <p className="text-12 text-destructive">{msg}</p>}
      <Button disabled={busy} onClick={submit}>{busy ? "Menyimpan…" : "Buka saldo"}</Button>
    </section>
  );
}

export function CashCloseForm() {
  const router = useRouter();
  const [v, setV] = useState<Amounts>(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit() {
    if (!confirm("Tutup saldo kasir hari ini? Tak bisa diubah.")) return;
    setBusy(true);
    const r = await closeCashSession(v);
    setBusy(false);
    if (!r.ok) return setMsg(r.message ?? "Gagal.");
    router.refresh();
  }
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="text-16 font-semibold">Tutup Saldo Kasir</h2>
        <p className="text-12 text-muted-foreground">Hitung fisik cash + saldo akhir EDC sebelum absen pulang.</p>
      </div>
      <AmountGrid v={v} set={setV} />
      {msg && <p className="text-12 text-destructive">{msg}</p>}
      <Button disabled={busy} onClick={submit}>{busy ? "Menyimpan…" : "Tutup saldo"}</Button>
    </section>
  );
}
