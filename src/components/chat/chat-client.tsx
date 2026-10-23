"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RoomListItem, ChatMsg } from "@/server/chat/queries";
import {
  sendMessage,
  startDM,
  createGroup,
  markRoomRead,
  uploadChatImage,
} from "@/server/actions/chat";
import { compressImage } from "@/lib/image";

type UserRef = { id: string; fullName: string };

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

export function ChatClient({
  me,
  rooms,
  users,
  canCreateGroup,
}: {
  me: string;
  rooms: RoomListItem[];
  users: UserRef[];
  canCreateGroup: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const [newDMOpen, setNewDMOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | undefined>(undefined);

  function scrollBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function loadFull(roomId: string) {
    const res = await fetch(`/api/chat/messages?room=${roomId}`);
    if (!res.ok) return;
    const data: { messages: ChatMsg[] } = await res.json();
    setMessages(data.messages);
    lastAtRef.current = data.messages.at(-1)?.createdAt;
    scrollBottom();
  }

  async function openRoom(room: { id: string; name: string }) {
    setActive(room);
    setMessages([]);
    lastAtRef.current = undefined;
    await loadFull(room.id);
    await markRoomRead(room.id);
    router.refresh();
  }

  // polling pesan baru tiap 3s
  useEffect(() => {
    if (!active) return;
    const id = setInterval(async () => {
      const after = lastAtRef.current;
      const res = await fetch(
        `/api/chat/messages?room=${active.id}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      if (!res.ok) return;
      const data: { messages: ChatMsg[] } = await res.json();
      if (data.messages.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const add = data.messages.filter((m) => !seen.has(m.id));
          return add.length ? [...prev, ...add] : prev;
        });
        lastAtRef.current = data.messages.at(-1)?.createdAt;
        scrollBottom();
        markRoomRead(active.id);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [active]);

  function send() {
    if (!active || !text.trim()) return;
    const room = active;
    const body = text;
    setText("");
    startSend(async () => {
      await sendMessage(room.id, body);
      await loadFull(room.id);
      router.refresh();
    });
  }

  function pickImage() {
    fileRef.current?.click();
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    startSend(async () => {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.set("image", blob, "chat.jpg");
      const up = await uploadChatImage(fd);
      if (!up.ok || !up.key) {
        alert(up.message ?? "Gagal unggah.");
        return;
      }
      await sendMessage(active.id, "", up.key);
      await loadFull(active.id);
      router.refresh();
    });
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-0 overflow-hidden rounded-lg border bg-card md:h-[calc(100dvh-8rem)]">
      {/* daftar room */}
      <div
        className={cn(
          "flex w-full flex-col border-r md:w-72",
          active ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <span className="font-semibold">Chat</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="DM baru" onClick={() => setNewDMOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
            {canCreateGroup && (
              <Button variant="ghost" size="icon" aria-label="Grup baru" onClick={() => setNewGroupOpen(true)}>
                <Users className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 && (
            <p className="p-4 text-center text-14 text-muted-foreground">Belum ada obrolan.</p>
          )}
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => openRoom({ id: r.id, name: r.name })}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left hover:bg-accent",
                active?.id === r.id && "bg-accent",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-14 text-muted-foreground">{r.lastBody ?? "—"}</p>
              </div>
              {r.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-12 text-white">
                  {r.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* pane pesan */}
      <div className={cn("flex min-w-0 flex-1 flex-col", active ? "flex" : "hidden md:flex")}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Pilih obrolan.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setActive(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold">{active.name}</span>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.senderId === me;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-lg px-3 py-2 text-14",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {!mine && <p className="mb-0.5 text-12 font-semibold opacity-70">{m.senderName}</p>}
                      {m.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.imageUrl} alt="gambar" className="mb-1 max-h-60 rounded-md" />
                      )}
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      <p className="mt-0.5 text-right text-[10px] opacity-60">
                        {timeFmt.format(new Date(m.createdAt))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t p-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImage} />
              <Button variant="ghost" size="icon" onClick={pickImage} disabled={sending}>
                <ImagePlus className="h-5 w-5" />
              </Button>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Tulis pesan…"
              />
              <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}
      </div>

      <NewDMDialog
        open={newDMOpen}
        onOpenChange={setNewDMOpen}
        users={users}
        onPick={(u) => {
          setNewDMOpen(false);
          startSend(async () => {
            const r = await startDM(u.id);
            if (r.ok && r.id) {
              await openRoom({ id: r.id, name: u.fullName });
            }
          });
        }}
      />
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        users={users}
        onCreate={(name, ids) => {
          setNewGroupOpen(false);
          startSend(async () => {
            const r = await createGroup(name, ids);
            if (r.ok && r.id) await openRoom({ id: r.id, name });
            else alert(r.message);
          });
        }}
      />
    </div>
  );
}

function NewDMDialog({
  open,
  onOpenChange,
  users,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: UserRef[];
  onPick: (u: UserRef) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => u.fullName.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat baru</DialogTitle>
        </DialogHeader>
        <Input placeholder="Cari orang…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u)}
              className="w-full rounded-md px-3 py-2 text-left hover:bg-accent"
            >
              {u.fullName}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewGroupDialog({
  open,
  onOpenChange,
  users,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: UserRef[];
  onCreate: (name: string, ids: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  function toggle(id: string) {
    setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grup baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama grup</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Anggota</Label>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-14">
                  <Checkbox checked={ids.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                  {u.fullName}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => onCreate(name, ids)} disabled={name.trim().length < 2 || ids.length === 0}>
            Buat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
