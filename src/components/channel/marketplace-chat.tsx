"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { chatMessages, listChats, sendChat, type ChatConv } from "@/server/actions/marketplace-chat";
import type { MpMsg } from "@/server/marketplace/shopee";
import { DEMO_MSGS } from "./marketplace-chat-demo";

const LABEL = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia" } as const;
const TAG = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600" } as const;
const jam = (ms: number) =>
  ms ? new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** Inbox chat Shopee + Tokopedia. Daftar diperbarui tiap 15 dtk, chat terbuka tiap 10 dtk. */
/** demo = data contoh lokal: tidak memanggil API, balasan hanya tampil di layar. */
export function MarketplaceChat({ initial, demo = false }: { initial: { convs: ChatConv[]; errors: string[] }; demo?: boolean }) {
  const [convs, setConvs] = useState(initial.convs);
  const [errors, setErrors] = useState(initial.errors);
  const [open, setOpen] = useState<ChatConv | null>(null);
  const [msgs, setMsgs] = useState<MpMsg[]>([]);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    if (demo) return;
    const r = await listChats().catch(() => null);
    if (!r) return;
    setConvs(r.convs);
    setErrors(r.errors);
  }, [demo]);

  const loadMsgs = useCallback(async (c: ChatConv) => {
    if (demo) return setMsgs(DEMO_MSGS[c.id] ?? []);
    const r = await chatMessages(c.platform, c.id).catch(() => ({ ok: false, message: "Gagal memuat. Muat ulang halaman." }) as const);
    if (r.ok && "messages" in r && r.messages) {
      setMsgs(r.messages);
      setMsgErr(null);
    } else setMsgErr(r.message ?? "Gagal memuat chat.");
  }, [demo]);

  useEffect(() => {
    const t = setInterval(() => void refreshList(), 15_000);
    return () => clearInterval(t);
  }, [refreshList]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void loadMsgs(open), 10_000);
    return () => clearInterval(t);
  }, [open, loadMsgs]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  function pick(c: ChatConv) {
    setOpen(c);
    setConvs((cs) => cs.map((x) => (x.id === c.id && x.platform === c.platform ? { ...x, unread: 0 } : x)));
    setMsgs([]);
    setMsgErr(null);
    void loadMsgs(c);
  }

  function send() {
    if (!open || !text.trim()) return;
    const c = open;
    const body = text;
    if (demo) {
      const msg: MpMsg = { id: String(Date.now()), mine: true, text: body.trim(), image: null, at: Date.now() };
      DEMO_MSGS[c.id] = [...(DEMO_MSGS[c.id] ?? []), msg];
      setMsgs(DEMO_MSGS[c.id]);
      setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, last: msg.text, at: msg.at, unread: 0 } : x)));
      setText("");
      return;
    }
    startSend(async () => {
      const r = await sendChat(c.platform, c.id, c.toId, body).catch(() => ({ ok: false, message: "Gagal kirim. Muat ulang halaman." }));
      if (!r.ok) {
        setMsgErr(r.message ?? "Gagal kirim.");
        return;
      }
      setText("");
      await loadMsgs(c);
      void refreshList();
    });
  }

  return (
    <div className="grid h-[calc(100dvh-10rem)] min-h-[420px] md:h-[calc(100dvh-7rem)] overflow-hidden rounded-lg border bg-card md:grid-cols-[320px_1fr]">
      {/* Daftar chat */}
      <div className={`flex min-h-0 flex-col border-r ${open ? "hidden md:flex" : "flex"}`}>
        {errors.map((e) => (
          <p key={e} className="border-b p-2 text-12 text-destructive">
            {e}
          </p>
        ))}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {convs.length === 0 && <li className="p-4 text-14 text-muted-foreground">Belum ada chat. Pastikan toko tersambung dan izin Chat aktif.</li>}
          {convs.map((c) => (
            <li key={`${c.platform}:${c.id}`}>
              <button
                type="button"
                onClick={() => pick(c)}
                className={`flex w-full flex-col gap-1 border-b p-3 text-left hover:bg-muted ${open?.id === c.id && open.platform === c.platform ? "bg-muted" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-12 font-medium ${TAG[c.platform]}`}>{LABEL[c.platform]}</span>
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  {c.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-12 font-medium text-primary-foreground">{c.unread}</span>}
                </span>
                <span className="flex items-center gap-2 text-12 text-muted-foreground">
                  <span className="flex-1 truncate">{c.last || "-"}</span>
                  <span className="shrink-0">{jam(c.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Isi chat */}
      <div className={`min-h-0 flex-col ${open ? "flex" : "hidden md:flex"}`}>
        {!open ? (
          <p className="m-auto text-14 text-muted-foreground">Pilih chat di kiri.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <button type="button" onClick={() => setOpen(null)} className="rounded border px-2 py-0.5 text-14 md:hidden">
                Kembali
              </button>
              <span className={`rounded px-1.5 py-0.5 text-12 font-medium ${TAG[open.platform]}`}>{LABEL[open.platform]}</span>
              <span className="truncate font-semibold">{open.name}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-14 ${m.mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- gambar dari CDN marketplace
                      <img src={m.image} alt="Gambar dari pembeli" className="mb-1 max-h-60 rounded" />
                    )}
                    {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                    <p className="mt-1 text-right text-[11px] opacity-70">{jam(m.at)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            {msgErr && <p className="border-t px-3 py-2 text-12 text-destructive">{msgErr}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2 border-t p-3"
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                maxLength={1000}
                placeholder="Tulis balasan… (Enter kirim, Shift+Enter baris baru)"
                aria-label="Balasan"
                className="min-h-0 flex-1 resize-none rounded-md border bg-background px-2 py-1 text-14"
              />
              <button type="submit" disabled={sending || !text.trim()} className="self-end rounded-md bg-primary px-4 py-2 text-14 font-medium text-primary-foreground disabled:opacity-50">
                {sending ? "Mengirim…" : "Kirim"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
