"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearBranchPosPassword, setBranchPosPassword } from "@/server/actions/pos";

/** Atur / matikan password kasir satu cabang (di dashboard Tirtonic POS). */
export function PosPassword({ branchId, active }: { branchId: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setMsg(r.message ?? "Gagal.");
      setOpen(false);
      setPw("");
      setMsg(null);
      router.refresh();
    });

  if (!open)
    return (
      <span className="inline-flex items-center gap-2">
        <span className={active ? "text-success" : "text-muted-foreground"}>{active ? "Aktif" : "Belum diatur"}</span>
        <button onClick={() => setOpen(true)} className="text-primary underline">{active ? "Ganti" : "Atur"}</button>
      </span>
    );

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1.5">
        <input
          autoFocus
          autoComplete="off"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password baru (min. 6)"
          className="h-8 w-44 rounded-sm border px-2 text-14"
        />
        <button disabled={pending || !pw.trim()} onClick={() => run(() => setBranchPosPassword(branchId, pw))} className="h-8 rounded-sm bg-primary px-3 text-14 font-semibold text-primary-foreground disabled:opacity-50">
          Simpan
        </button>
        <button onClick={() => { setOpen(false); setMsg(null); }} className="h-8 px-2 text-14 text-muted-foreground">Batal</button>
      </span>
      {active && (
        <button
          disabled={pending}
          onClick={() => confirm("Matikan kasir cabang ini? Semua mesin cabang ini akan keluar.") && run(() => clearBranchPosPassword(branchId))}
          className="text-12 text-destructive"
        >
          Matikan kasir cabang ini
        </button>
      )}
      <span className="text-12 text-muted-foreground">Ganti password = semua mesin cabang ini keluar.</span>
      {msg && <span className="text-12 text-destructive">{msg}</span>}
    </span>
  );
}
