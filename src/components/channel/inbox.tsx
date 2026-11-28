"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Send } from "lucide-react";
import { balasChat, tandaiDibaca } from "@/server/actions/inbox";

export type Chat = { id: string; name: string; via: string; channel: string; lastText: string; lastAt: string; unread: number };
type Msg = { id: string; dir: string; text: string; at: string; by: string | null; error: string | null };

const jam = (iso: string) => {
  const d = new Date(iso);
  const hariIni = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", ...(hariIni ? { timeStyle: "short" } : { dateStyle: "short", timeStyle: "short" }) });
};

export function Inbox({ threads, aktif, msgs, q, buka }: { threads: Chat[]; aktif: Chat | null; msgs: Msg[]; q: string; buka: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const bawah = useRef<HTMLDivElement>(null);

  // ponytail: polling 5 detik (router.refresh); ganti ke SSE kalau chat ramai.
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) router.refresh(); }, 5000);
    return () => clearInterval(id);
  }, [router]);
  useEffect(() => { if (aktif?.unread) void tandaiDibaca(aktif.id); }, [aktif?.id, aktif?.unread]);
  useEffect(() => { bawah.current?.scrollIntoView({ block: "end" }); }, [aktif?.id, msgs.length]);

  const kirim = () => {
    if (!aktif || !text.trim() || busy) return;
    setErr("");
    start(async () => {
      const r = await balasChat(aktif.id, text);
      if (r.ok) setText("");
      else setErr(r.message ?? "Gagal.");
      router.refresh();
    });
  };

  return (
    <div className="grid h-[calc(100dvh-12rem)] min-h-[420px] grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[320px_1fr]">
      <div className={`flex min-h-0 flex-col border-r ${aktif ? "hidden md:flex" : "flex"}`}>
        <form className="border-b p-2">
          <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-2">
            <Search className="size-4 text-muted-foreground" />
            <input name="q" defaultValue={q} placeholder="Cari nama / nomor / pesan" className="h-full w-full bg-transparent text-14 outline-none" />
          </label>
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {threads.length === 0 && <p className="p-4 text-14 text-muted-foreground">Belum ada chat.</p>}
          {threads.map((c) => (
            <Link key={c.id} href={`/channel/inbox?t=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`block border-b px-3 py-2 hover:bg-muted ${aktif?.id === c.id ? "bg-muted" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <span className={`truncate text-14 ${c.unread ? "font-semibold" : ""}`}>{c.name}</span>
                <span className="shrink-0 text-12 text-muted-foreground">{jam(c.lastAt)}</span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-12 text-muted-foreground"><span className={c.channel === "IG" ? "text-pink-600" : "text-emerald-600"}>{c.via}</span> · {c.lastText}</span>
                {c.unread > 0 && <span className="shrink-0 rounded-full bg-primary px-1.5 text-12 text-primary-foreground">{c.unread}</span>}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {aktif ? (
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Link href={`/channel/inbox${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="text-14 text-muted-foreground md:hidden">←</Link>
            <span className="font-medium">{aktif.name}</span>
            <span className={`text-12 ${aktif.channel === "IG" ? "text-pink-600" : "text-emerald-600"}`}>{aktif.via}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.dir === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-14 whitespace-pre-wrap ${m.dir === "out" ? (m.error ? "bg-destructive/10" : "bg-primary text-primary-foreground") : "border bg-background"}`}>
                  {m.text}
                  <span className={`mt-0.5 block text-right text-[11px] ${m.dir === "out" && !m.error ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {m.by ? `${m.by} · ` : ""}{jam(m.at)}
                  </span>
                  {m.error && <span className="block text-12 text-destructive">Gagal: {m.error}</span>}
                </div>
              </div>
            ))}
            <div ref={bawah} />
          </div>
          <div className="space-y-1 border-t p-2">
            {!buka && <p className="text-12 text-amber-600">Pesan terakhir pelanggan sudah lebih dari 24 jam. Meta bisa menolak balasan; balas dari HP atau tunggu pelanggan chat lagi.</p>}
            {err && <p role="alert" className="text-12 text-destructive">{err}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim(); } }}
                rows={2}
                placeholder="Tulis balasan… (Enter kirim, Shift+Enter baris baru)"
                className="min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-14"
              />
              <button type="button" onClick={kirim} disabled={busy || !text.trim()} aria-label="Kirim" className="h-10 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-40">
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden items-center justify-center text-14 text-muted-foreground md:flex">Pilih chat di kiri.</div>
      )}
    </div>
  );
}
