"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aksiKomentar } from "@/server/actions/instagram";

/** Balas 1 komentar IG: publik / DM / sembunyikan. */
export function BalasKomentar({ id, user, hidden }: { id: string; user: string; hidden: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const kirim = (aksi: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("aksi", aksi);
    fd.set("text", aksi === "balas" && text && !text.startsWith(`@${user}`) ? `@${user} ${text}` : text);
    start(async () => {
      const r = await aksiKomentar(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) { setText(""); router.refresh(); }
    });
  };
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) kirim("balas"); }} disabled={busy} placeholder={`Balas @${user}…`} className="h-9 min-w-48 flex-1 rounded-md border bg-background px-3" />
        <button type="button" disabled={busy || !text.trim()} onClick={() => kirim("balas")} className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-40">Balas</button>
        <button type="button" disabled={busy || !text.trim()} onClick={() => kirim("dm")} className="h-9 rounded-md border px-3 disabled:opacity-40">Kirim DM</button>
        <button type="button" disabled={busy} onClick={() => kirim(hidden ? "tampil" : "sembunyi")} className="h-9 rounded-md border px-3 text-muted-foreground disabled:opacity-40">{hidden ? "Tampilkan" : "Sembunyikan"}</button>
      </div>
      {msg && <p className={`text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
