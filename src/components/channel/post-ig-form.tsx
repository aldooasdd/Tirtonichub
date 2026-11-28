"use client";

import { useRef, useState, useTransition } from "react";
import { buatPostIg } from "@/server/actions/instagram";

/** Form posting IG: foto JPG (1–10 = carousel) atau 1 video MP4 (Reels), caption, jadwal opsional (WIB). */
export function PostIgForm() {
  const form = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        start(async () => {
          try {
            const r = await buatPostIg(fd);
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) form.current?.reset();
          } catch {
            setMsg({ ok: false, text: "Gagal mengunggah. File terlalu besar atau koneksi putus." });
          }
        });
      }}
      className="space-y-3 text-14"
    >
      <label className="block space-y-1">
        <span className="text-12 text-muted-foreground">Foto JPG (1 foto, atau 2–10 foto = carousel) atau 1 video MP4 untuk Reels (maks 30 MB)</span>
        <input name="file" type="file" multiple required accept="image/jpeg,video/mp4" className="block w-full text-14" />
      </label>
      <textarea name="caption" rows={4} maxLength={2200} placeholder="Caption + hashtag" className="w-full rounded-md border bg-background px-3 py-2" />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Jadwal (WIB, kosong = terbit sekarang)
          <input name="jadwal" type="datetime-local" className="h-10 rounded-md border bg-background px-3 text-14 text-foreground" />
        </label>
        <button disabled={busy} className="h-10 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-40">{busy ? "Mengunggah…" : "Posting"}</button>
      </div>
      {msg && <p role="status" className={`rounded-md px-3 py-2 ${msg.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
    </form>
  );
}
