"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, X, ChevronLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage, markRoomRead } from "@/server/actions/chat";
import type { RoomListItem } from "@/server/chat/queries";

export type Presence = { id: string; name: string; late: boolean };
type Msg = {
  id: string;
  body: string | null;
  imageUrl: string | null;
  senderId: string;
  senderName: string;
  createdAt: string;
};

const GLASS =
  "border border-white/40 bg-white/70 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function FloatingChat({
  rooms,
  presence,
  me,
}: {
  rooms: RoomListItem[];
  presence: Presence[];
  me: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<RoomListItem | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const afterRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalUnread = rooms.reduce((s, r) => s + r.unread, 0);

  const poll = useCallback(
    async (roomId: string, initial: boolean) => {
      const after = afterRef.current;
      const res = await fetch(
        `/api/chat/messages?room=${roomId}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Msg[] };
      const list = data.messages;
      if (list.length) {
        afterRef.current = list[list.length - 1].createdAt;
        setMsgs((prev) => (initial ? list : [...prev, ...list.filter((m) => !prev.some((p) => p.id === m.id))]));
        markRoomRead(roomId);
      } else if (initial) {
        setMsgs([]);
      }
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    afterRef.current = undefined;
    setMsgs([]);
    poll(active.id, true);
    const t = setInterval(() => poll(active.id, false), 3000);
    return () => clearInterval(t);
  }, [active, poll]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs]);

  async function send() {
    if (!active || !text.trim()) return;
    const body = text;
    setText("");
    await sendMessage(active.id, body);
    poll(active.id, false);
  }

  // Launcher (desktop only)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 hidden items-center gap-2 rounded-full px-5 py-3 text-14 font-medium transition-transform hover:scale-105 md:flex",
          GLASS,
        )}
      >
        <MessageSquare className="h-5 w-5" />
        Chat
        {totalUnread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-11 text-primary-foreground">
            {totalUnread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 hidden h-[70vh] max-h-[640px] w-[380px] flex-col overflow-hidden rounded-3xl md:flex",
        GLASS,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/30 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          {active && (
            <button onClick={() => setActive(null)} className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <span className="font-semibold">{active ? active.name : "Chat"}</span>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            setActive(null);
          }}
          className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {active ? (
        <>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {msgs.length === 0 && (
              <p className="py-10 text-center text-13 text-muted-foreground">Belum ada pesan.</p>
            )}
            {msgs.map((m) => {
              const mine = m.senderId === me;
              return (
                <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  {!mine && active.type === "GROUP" && (
                    <span className="px-1 text-11 text-muted-foreground">{m.senderName}</span>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-14",
                      mine ? "bg-primary text-primary-foreground" : "bg-black/5 dark:bg-white/10",
                    )}
                  >
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="" className="max-h-48 rounded-lg" />
                    ) : (
                      m.body
                    )}
                    <div className={cn("mt-0.5 text-10", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {hhmm(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 border-t border-white/30 p-2 dark:border-white/10">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Tulis pesan…"
              className="flex-1 rounded-full bg-black/5 px-4 py-2 text-14 outline-none dark:bg-white/10"
            />
            <button onClick={send} className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50" disabled={!text.trim()}>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Hadir hari ini */}
          <div className="border-b border-white/30 px-4 py-3 dark:border-white/10">
            <p className="mb-2 text-12 font-semibold text-muted-foreground">Hadir hari ini</p>
            {presence.length === 0 ? (
              <p className="text-13 text-muted-foreground">Belum ada yang absen masuk.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {presence.map((p) => (
                  <div key={p.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-13 font-semibold text-primary">
                      {initials(p.name)}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900",
                          p.late ? "bg-orange-500" : "bg-green-500",
                        )}
                      />
                    </div>
                    <span className="w-full truncate text-center text-10 text-muted-foreground">
                      {p.name.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daftar chat */}
          {rooms.length === 0 ? (
            <p className="px-4 py-10 text-center text-13 text-muted-foreground">Belum ada chat.</p>
          ) : (
            <div className="divide-y divide-white/20 dark:divide-white/5">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActive(r)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-13 font-semibold text-primary">
                    {r.type === "GROUP" ? "#" : initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.lastAt && <span className="shrink-0 text-10 text-muted-foreground">{hhmm(r.lastAt)}</span>}
                    </div>
                    <p className="truncate text-13 text-muted-foreground">{r.lastBody ?? "Belum ada pesan"}</p>
                  </div>
                  {r.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-11 text-primary-foreground">
                      {r.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
