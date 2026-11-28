"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Tombol = { label: string; action: (fd: FormData) => Promise<void>; tanya?: string; tone?: string };

/** Bar pilih banyak di dalam <form>: Pilih semua + tombol aksi untuk checkbox name="pick". */
export function PilihBar({ tombol }: { tombol: Tombol[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const [total, setTotal] = useState(0);
  const boxes = () => [...(ref.current?.closest("form")?.querySelectorAll<HTMLInputElement>('input[name="pick"]') ?? [])];
  useEffect(() => {
    const form = ref.current?.closest("form");
    const hitung = () => { const b = boxes(); setN(b.filter((x) => x.checked).length); setTotal(b.length); };
    hitung();
    form?.addEventListener("change", hitung);
    return () => form?.removeEventListener("change", hitung);
  });
  const semua = (on: boolean) => { boxes().forEach((b) => (b.checked = on)); setN(on ? boxes().length : 0); };
  return (
    <div ref={ref} className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 text-14">
      <label className="flex items-center gap-2 px-1">
        <input type="checkbox" checked={total > 0 && n === total} onChange={(e) => semua(e.target.checked)} aria-label="Pilih semua" />
        Pilih semua
      </label>
      <span className="text-muted-foreground">{n} dipilih</span>
      {n > 0 && tombol.map((t) => <Aksi key={t.label} t={t} n={n} />)}
    </div>
  );
}

function Aksi({ t, n }: { t: Tombol; n: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={t.action}
      disabled={pending}
      onClick={(e) => { if (t.tanya && !confirm(t.tanya.replace("{n}", String(n)))) e.preventDefault(); }}
      className={`h-8 rounded-md border px-3 font-medium disabled:opacity-40 ${t.tone ?? ""}`}
    >
      {pending ? "Memproses…" : `${t.label} (${n})`}
    </button>
  );
}
