"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, Search, SendHorizontal } from "lucide-react";
import { chatMessages, listChats, sendChat, type ChatConv } from "@/server/actions/marketplace-chat";
import type { MpMsg } from "@/server/marketplace/shopee";
import { DEMO_MSGS } from "./marketplace-chat-demo";

const LABEL = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia" } as const;
const TAG = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600" } as const;
const DOT = { SHOPEE: "bg-orange-500", TOKOPEDIA: "bg-emerald-500" } as const;
const TABS = [
  { key: "semua", label: "Semua" },
  { key: "unread", label: "Belum dibaca" },
  { key: "SHOPEE", label: "Shopee" },
  { key: "TOKOPEDIA", label: "Tokopedia" },
] as const;

const TZ = "Asia/Jakarta";
const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
const pukul = (ms: number) => (ms ? new Date(ms).toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "");
/** Hari ini → jam; selain itu tanggal singkat. */
const waktuList = (ms: number) =>
  !ms ? "" : dayKey(ms) === dayKey(Date.now()) ? pukul(ms) : new Date(ms).toLocaleDateString("id-ID", { timeZone: TZ, day: "2-digit", month: "short" });
const labelHari = (ms: number) => {
  const k = dayKey(ms);
  if (k === dayKey(Date.now())) return "Hari ini";
  if (k === dayKey(Date.now() - 86400_000)) return "Kemarin";
  return new Date(ms).toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
};

function Avatar({ c, size = "size-10" }: { c: ChatConv; size?: string }) {
  return (
    <span className={`relative shrink-0 ${size}`}>
      {c.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar dari CDN marketplace
        <img src={c.avatar} alt="" className={`${size} rounded-full object-cover`} />
      ) : (
        <span className={`flex ${size} items-center justify-center rounded-full bg-muted text-14 font-semibold uppercase`}>{c.name.slice(0, 1)}</span>
      )}
      <span className={`absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-card ${DOT[c.platform]}`} title={LABEL[c.platform]} />
    </span>
  );
}

/** Inbox chat Shopee + Tokopedia. Daftar diperbarui tiap 15 dtk, chat terbuka tiap 10 dtk. */
/** demo = data contoh lokal: tidak memanggil API, balasan hanya tampil di layar. */
export function MarketplaceChat({
  initial,
  demo = false,
}: {
  initial: { convs: ChatConv[]; errors: string[] };
  demo?: boolean;
}) {
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

  const loadMsgs = useCallback(
    async (c: ChatConv) => {
      if (demo) return setMsgs(DEMO_MSGS[c.id] ?? []);
      const r = await chatMessages(c.platform, c.id).catch(
        () =>
          ({
            ok: false,
            message: "Gagal memuat. Muat ulang halaman.",
          }) as const,
      );
      if (r.ok && "messages" in r && r.messages) {
        setMsgs(r.messages);
        setMsgErr(null);
      } else setMsgErr(r.message ?? "Gagal memuat chat.");
    },
    [demo],
  );

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
    setConvs((cs) =>
      cs.map((x) =>
        x.id === c.id && x.platform === c.platform ? { ...x, unread: 0 } : x,
      ),
    );
    setMsgs([]);
    setMsgErr(null);
    void loadMsgs(c);
  }

  function send() {
    if (!open || !text.trim()) return;
    const c = open;
    const body = text;
    if (demo) {
      const msg: MpMsg = {
        id: String(Date.now()),
        mine: true,
        text: body.trim(),
        image: null,
        at: Date.now(),
      };
      DEMO_MSGS[c.id] = [...(DEMO_MSGS[c.id] ?? []), msg];
      setMsgs(DEMO_MSGS[c.id]);
      setConvs((cs) =>
        cs.map((x) =>
          x.id === c.id ? { ...x, last: msg.text, at: msg.at, unread: 0 } : x,
        ),
      );
      setText("");
      return;
    }
    startSend(async () => {
      const r = await sendChat(c.platform, c.id, c.toId, body).catch(() => ({
        ok: false,
        message: "Gagal kirim. Muat ulang halaman.",
      }));
      if (!r.ok) {
        setMsgErr(r.message ?? "Gagal kirim.");
        return;
      }
      setText("");
      await loadMsgs(c);
      void refreshList();
    });
  }

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("semua");
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return convs.filter(
      (c) =>
        (tab === "semua" || (tab === "unread" ? c.unread > 0 : c.platform === tab)) &&
        (!k || c.name.toLowerCase().includes(k) || c.last.toLowerCase().includes(k)),
    );
  }, [convs, q, tab]);

  return (
    <div className="grid h-[calc(100dvh-10rem)] min-h-[420px] gap-4 md:h-[calc(100dvh-7rem)] md:grid-cols-[340px_1fr]">
      {/* Daftar chat */}
      <aside className={`min-h-0 flex-col gap-3 rounded-xl border bg-card p-3 ${open ? "hidden md:flex" : "flex"}`}>
        <label className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pembeli atau pesan" aria-label="Cari chat" className="w-full bg-transparent text-14 outline-none" />
        </label>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex-auto rounded-md px-2 py-1.5 text-12 font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${tab === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {errors.map((e) => (
          <p key={e} className="rounded-md bg-destructive/10 p-2 text-12 text-destructive">
            {e}
          </p>
        ))}
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {shown.length === 0 && (
            <li className="p-4 text-center text-14 text-muted-foreground">{convs.length ? "Tidak ada chat yang cocok." : "Belum ada chat. Pastikan toko tersambung dan izin Chat aktif."}</li>
          )}
          {shown.map((c) => {
            const active = open?.id === c.id && open.platform === c.platform;
            return (
              <li key={`${c.platform}:${c.id}`}>
                <button type="button" onClick={() => pick(c)} className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${active ? "bg-muted" : "hover:bg-muted/60"}`}>
                  <Avatar c={c} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`flex-1 truncate text-14 ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                      <span className="shrink-0 text-12 text-muted-foreground">{waktuList(c.at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`flex-1 truncate text-12 ${c.unread ? "text-foreground" : "text-muted-foreground"}`}>{c.last || "-"}</span>
                      {c.unread > 0 && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{c.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Isi chat */}
      <section className={`min-h-0 flex-col overflow-hidden rounded-xl border bg-card ${open ? "flex" : "hidden md:flex"}`}>
        {!open ? (
          <p className="m-auto text-14 text-muted-foreground">Pilih chat untuk mulai membalas.</p>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <button type="button" onClick={() => setOpen(null)} aria-label="Kembali ke daftar chat" className="-ml-1 rounded-md p-1 hover:bg-muted md:hidden">
                <ChevronLeft className="size-5" />
              </button>
              <Avatar c={open} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{open.name}</p>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TAG[open.platform]}`}>{LABEL[open.platform]}</span>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 px-4 py-4">
              {msgs.map((m, i) => {
                const newDay = i === 0 || dayKey(msgs[i - 1].at) !== dayKey(m.at);
                const prevBuyer = i > 0 && !msgs[i - 1].mine && !msgs[i - 1].system && !newDay;
                return (
                  <div key={m.id} className="space-y-3">
                    {newDay && (
                      <div className="flex justify-center">
                        <span className="rounded-full border bg-card px-3 py-1 text-12 font-medium">{labelHari(m.at)}</span>
                      </div>
                    )}
                    {m.bot ? (
                      <div className="flex justify-center">
                        <div className="w-full max-w-md rounded-xl border bg-card px-4 py-3 text-14">
                          <p className="mb-1 text-12 font-medium text-muted-foreground">Balasan otomatis · {pukul(m.at)}</p>
                          <p className="break-words whitespace-pre-wrap">{m.text}</p>
                        </div>
                      </div>
                    ) : m.system ? (
                      <div className="flex justify-center">
                        <p className="max-w-[85%] rounded-full border bg-card px-3 py-1 text-center text-12 whitespace-pre-wrap text-muted-foreground">
                          {m.text || "Pesan sistem"} · {pukul(m.at)}
                        </p>
                      </div>
                    ) : m.mine ? (
                      <div className="flex flex-col items-end">
                        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-14 text-primary-foreground">
                          {m.image && (
                            // eslint-disable-next-line @next/next/no-img-element -- gambar dari CDN marketplace
                            <img src={m.image} alt="" className="mb-1 max-h-64 rounded-lg" />
                          )}
                          {m.text && <p className="break-words whitespace-pre-wrap">{m.text}</p>}
                        </div>
                        <span className="mt-1 text-[11px] text-muted-foreground">{pukul(m.at)}</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-end gap-2">
                          {prevBuyer ? <span className="size-8 shrink-0" /> : <Avatar c={open} size="size-8" />}
                          <div className="flex max-w-[75%] flex-col items-start gap-1">
                            {m.image && (
                              // eslint-disable-next-line @next/next/no-img-element -- gambar dari pembeli
                              <img src={m.image} alt="Gambar dari pembeli" className="max-h-64 rounded-2xl border" />
                            )}
                            {m.text && <p className="rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-14 break-words whitespace-pre-wrap">{m.text}</p>}
                          </div>
                        </div>
                        <span className="mt-1 ml-10 block text-[11px] text-muted-foreground">{pukul(m.at)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>

            {msgErr && <p className="border-t bg-destructive/10 px-4 py-2 text-12 text-destructive">{msgErr}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2 border-t p-3"
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
                rows={1}
                maxLength={1000}
                placeholder="Tulis pesan…"
                aria-label="Balasan"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border bg-background px-4 py-2.5 text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label={sending ? "Mengirim" : "Kirim"}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                <SendHorizontal className="size-5" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
