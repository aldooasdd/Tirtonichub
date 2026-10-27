"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/server/actions/auth";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: "Konfirmasi password tidak sama." });
      return;
    }
    start(async () => {
      const r = await changePasswordAction(current, next);
      setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Tersimpan." : "Gagal.") });
      if (r.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    });
  }

  return (
    <section className="rounded-lg bg-card p-5">
      <h2 className="mb-4 font-semibold">Ganti password</h2>
      <form onSubmit={submit} className="max-w-sm space-y-3">
        <div className="space-y-2">
          <Label htmlFor="pw-cur">Password sekarang</Label>
          <Input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-new">Password baru</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-conf">Ulangi password baru</Label>
          <Input id="pw-conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {msg && <p className={`text-14 ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan password"}
        </Button>
      </form>
    </section>
  );
}
