"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, ClipboardList, Image as ImageIcon, MessageSquareText, Pencil, Plus, SendHorizontal, Settings, ShoppingBag, Smile, Trash2, X } from "lucide-react";
import {
  chatPickOrders,
  chatPickProducts,
  deleteTemplate,
  listTemplates,
  saveTemplate,
  sendChatCard,
  sendChatImage,
  type ChatTpl,
} from "@/server/actions/marketplace-chat";
import { statusLabel } from "@/lib/channel-status";
import { DEMO_TPLS } from "./marketplace-chat-demo";

// ponytail: daftar emoji tetap (emoji = teks biasa, aman untuk API Shopee & TikTok); pakai library picker kalau butuh pencarian.
const EMOJI = "😊 😀 😁 😄 🤗 🙏 👍 👌 👏 🙌 💪 ✨ 🎾 🏆 🔥 ❤️ 💯 ✅ 📦 🚚 🛍️ 🎁 💰 🤔 😅 😂 🥰 😍 😉 🙂 😔 😢 😮 👋 🤝 ⏰ 📍 ☺️".split(" ");
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const iconBtn = "flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted";

type Panel = null | "plus" | "tpl" | "emoji";
type Sub = null | "produk" | "pesanan";
type Pick = { id: string; title: string; sub: string };
const PLUS = [
  { key: "gambar", label: "Gambar", icon: ImageIcon },
  { key: "kamera", label: "Kamera", icon: Camera },
  { key: "produk", label: "Produk", icon: ShoppingBag },
  { key: "pesanan", label: "Riwayat pesanan", icon: ClipboardList },
] as const;

/** Kolom balas ala Tokopedia: + (gambar, kamera, produk, pesanan), template balasan (/shortcut), emoji. */
export function ChatComposer({
  platform,
  convId,
  demo,
  onSendText,
  onSent,
  onError,
}: {
  platform: "SHOPEE" | "TOKOPEDIA";
  convId: string;
  demo: boolean;
  onSendText: (text: string) => Promise<boolean>;
  onSent: () => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [sub, setSub] = useState<Sub>(null);
  const [busy, start] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const canRich = platform === "TOKOPEDIA" && !demo; // kartu & gambar: API TikTok saja

  // Template: dimuat sekali saat pertama dibutuhkan.
  const [tpls, setTpls] = useState<ChatTpl[] | null>(demo ? DEMO_TPLS : null);
  const loadTpls = () => {
    if (!demo) void listTemplates().then(setTpls).catch(() => setTpls([]));
  };
  useEffect(() => {
    if (tpls === null && (panel === "tpl" || text.startsWith("/"))) loadTpls();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup saat panel/slash pertama dibuka
  }, [panel, text]);

  const slash = text.startsWith("/") && !/\s/.test(text) ? text.slice(1).toLowerCase() : null;
  const suggestions = useMemo(() => (slash === null || !tpls ? [] : tpls.filter((t) => t.shortcut.startsWith(slash)).slice(0, 6)), [slash, tpls]);

  function toggle(p: Panel) {
    setPanel((cur) => (cur === p ? null : p));
    setSub(null);
  }
  function insert(s: string) {
    const el = input.current;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? at;
    setText(text.slice(0, at) + s + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + s.length, at + s.length);
    });
  }
  function applyTpl(t: ChatTpl) {
    setText(t.text);
    setPanel(null);
    requestAnimationFrame(() => input.current?.focus());
  }

  function plus(k: (typeof PLUS)[number]["key"]) {
    if (k === "gambar") fileRef.current?.click();
    else if (k === "kamera") camRef.current?.click();
    else setSub(k);
  }

  function submit() {
    const body = text.trim();
    if (!body || busy) return;
    start(async () => {
      if (await onSendText(body)) {
        setText("");
        setPanel(null);
      }
    });
  }

  function sendImage(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("platform", platform);
    fd.set("convId", convId);
    fd.set("file", file);
    start(async () => {
      const r = await sendChatImage(fd).catch(() => ({ ok: false, message: "Gagal kirim gambar. Muat ulang halaman." }));
      if (!r.ok) return onError(r.message ?? "Gagal kirim gambar.");
      setPanel(null);
      onSent();
    });
  }

  function sendCard(kind: "PRODUCT_CARD" | "ORDER_CARD", id: string) {
    start(async () => {
      const r = await sendChatCard(platform, convId, kind, id).catch(() => ({ ok: false, message: "Gagal kirim kartu. Muat ulang halaman." }));
      if (!r.ok) return onError(r.message ?? "Gagal kirim kartu.");
      setPanel(null);
      setSub(null);
      onSent();
    });
  }

  return (
    <div className="border-t">
      {suggestions.length > 0 && (
        <ul className="max-h-48 overflow-y-auto border-b bg-card p-1" aria-label="Saran template">
          {suggestions.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => applyTpl(t)} className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted">
                <span className="truncate text-14">{t.text}</span>
                <span className="text-12 text-muted-foreground">/{t.shortcut}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-1 p-3"
      >
        <button type="button" onClick={() => toggle("plus")} aria-label={panel === "plus" ? "Tutup menu" : "Menu lainnya"} aria-expanded={panel === "plus"} className={iconBtn}>
          {panel === "plus" ? <X className="size-5" /> : <Plus className="size-5" />}
        </button>
        <button type="button" onClick={() => toggle("tpl")} aria-label="Template balasan" aria-expanded={panel === "tpl"} className={`${iconBtn} ${panel === "tpl" ? "bg-muted" : ""}`}>
          <MessageSquareText className="size-5" />
        </button>
        <textarea
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanel(null);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (suggestions.length) applyTpl(suggestions[0]);
              else submit();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Kirim pesan… (ketik / untuk template)"
          aria-label="Balasan"
          className="mx-1 max-h-32 min-h-11 flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <button type="button" onClick={() => toggle("emoji")} aria-label="Emoji" aria-expanded={panel === "emoji"} className={`${iconBtn} ${panel === "emoji" ? "bg-muted" : ""}`}>
          <Smile className="size-5" />
        </button>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label={busy ? "Mengirim" : "Kirim"}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          <SendHorizontal className="size-5" />
        </button>
      </form>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => (sendImage(e.target.files?.[0]), (e.target.value = ""))} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (sendImage(e.target.files?.[0]), (e.target.value = ""))} />

      {panel === "emoji" && (
        <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto border-t p-3 sm:grid-cols-12" role="listbox" aria-label="Pilih emoji">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => insert(e)} className="rounded-md p-1 text-18 hover:bg-muted" aria-label={`Emoji ${e}`}>
              {e}
            </button>
          ))}
        </div>
      )}

      {panel === "plus" &&
        (sub ? (
          <Picker
            kind={sub}
            busy={busy}
            onBack={() => setSub(null)}
            onPick={(id) => sendCard(sub === "produk" ? "PRODUCT_CARD" : "ORDER_CARD", id)}
          />
        ) : (
          <div className="border-t p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {PLUS.map((x) => (
                <button
                  key={x.label}
                  type="button"
                  disabled={!canRich || busy}
                  onClick={() => plus(x.key)}
                  className="flex flex-col items-center gap-2 rounded-lg p-3 text-12 hover:bg-muted disabled:opacity-40"
                >
                  <x.icon className="size-6" />
                  {x.label}
                </button>
              ))}
            </div>
            {!canRich && (
              <p className="mt-2 text-center text-12 text-muted-foreground">
                {demo ? "Mode contoh: menu ini nonaktif." : "Gambar & kartu baru tersedia untuk chat Tokopedia."}
              </p>
            )}
            {busy && <p className="mt-2 text-center text-12 text-muted-foreground">Mengirim…</p>}
          </div>
        ))}

      {panel === "tpl" && <TemplatePanel tpls={tpls} demo={demo} onUse={applyTpl} onChanged={loadTpls} />}
    </div>
  );
}

/** Daftar produk / pesanan Tokopedia untuk dikirim sebagai kartu. */
function Picker({ kind, busy, onBack, onPick }: { kind: "produk" | "pesanan"; busy: boolean; onBack: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Pick[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const p =
        kind === "produk"
          ? chatPickProducts(q).then((r) => r.map((x) => ({ id: x.id, title: x.name, sub: `${rupiah(x.price)} · stok ${x.stock}` })))
          : chatPickOrders(q).then((r) =>
              r.map((x) => ({
                id: x.id,
                title: `${x.who} · ${rupiah(x.total)}`,
                sub: `${x.id} · ${statusLabel(x.status)} · ${new Date(x.at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short" })}`,
              })),
            );
      void p.then(setRows).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [kind, q]);

  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-md border px-2 py-1 text-12">
          Kembali
        </button>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === "produk" ? "Cari nama produk" : "Cari no. pesanan / nama penerima"}
          aria-label="Cari"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-14 outline-none"
        />
      </div>
      <ul className="max-h-60 space-y-1 overflow-y-auto">
        {rows === null && <li className="p-3 text-center text-12 text-muted-foreground">Memuat…</li>}
        {rows?.length === 0 && <li className="p-3 text-center text-12 text-muted-foreground">Tidak ada data. Sinkronkan toko dulu di Kelola Pesanan.</li>}
        {rows?.map((r) => (
          <li key={r.id}>
            <button type="button" disabled={busy} onClick={() => onPick(r.id)} className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted disabled:opacity-50">
              <span className="truncate text-14 font-medium">{r.title}</span>
              <span className="truncate text-12 text-muted-foreground">{r.sub}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Template balasan: tab per grup, klik untuk pakai, roda gigi untuk kelola. */
function TemplatePanel({ tpls, demo, onUse, onChanged }: { tpls: ChatTpl[] | null; demo: boolean; onUse: (t: ChatTpl) => void; onChanged: () => void }) {
  const [grup, setGrup] = useState("Semua");
  const [manage, setManage] = useState(false);
  const [form, setForm] = useState<{ id?: string; shortcut: string; text: string; grup: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const groups = ["Semua", ...new Set((tpls ?? []).map((t) => t.grup))];
  const shown = (tpls ?? []).filter((t) => grup === "Semua" || t.grup === grup);

  function save() {
    if (!form) return;
    start(async () => {
      const r = await saveTemplate(form).catch(() => ({ ok: false, message: "Gagal simpan." }));
      if (!r.ok) return setMsg(r.message ?? "Gagal simpan.");
      setForm(null);
      setMsg(null);
      onChanged();
    });
  }
  function remove(id: string) {
    start(async () => {
      await deleteTemplate(id).catch(() => null);
      onChanged();
    });
  }

  return (
    <div className="border-t">
      <div className="flex items-center gap-1 border-b px-3">
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrup(g)}
              className={`border-b-2 px-3 py-2 text-14 whitespace-nowrap ${grup === g ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
            >
              {g}
            </button>
          ))}
        </div>
        {!demo && (
          <button type="button" onClick={() => (setManage((v) => !v), setForm(null))} aria-label="Kelola template" aria-pressed={manage} className={`rounded-md p-2 ${manage ? "bg-muted" : "hover:bg-muted"}`}>
            <Settings className="size-5" />
          </button>
        )}
      </div>

      {manage && (
        <div className="space-y-2 border-b p-3">
          {form ? (
            <>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1 text-12 text-muted-foreground">
                  Shortcut
                  <input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="harga" className="h-9 rounded-md border bg-background px-2 text-14" />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-12 text-muted-foreground">
                  Grup
                  <input value={form.grup} onChange={(e) => setForm({ ...form, grup: e.target.value })} placeholder="tirtonic" className="h-9 rounded-md border bg-background px-2 text-14" />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-12 text-muted-foreground">
                Isi balasan
                <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={3} maxLength={2000} className="rounded-md border bg-background px-2 py-1 text-14" />
              </label>
              {msg && <p className="text-12 text-destructive">{msg}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={save} className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-50">
                  Simpan
                </button>
                <button type="button" onClick={() => (setForm(null), setMsg(null))} className="h-9 rounded-md border px-4 text-14">
                  Batal
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setForm({ shortcut: "", text: "", grup: grup === "Semua" ? "tirtonic" : grup })} className="h-9 w-full rounded-md border text-14 font-medium hover:bg-muted">
              + Tambah template
            </button>
          )}
        </div>
      )}

      <ul className="max-h-64 overflow-y-auto p-1">
        {tpls === null && <li className="p-3 text-center text-12 text-muted-foreground">Memuat…</li>}
        {tpls?.length === 0 && <li className="p-3 text-center text-12 text-muted-foreground">Belum ada template. Klik ⚙ untuk menambah.</li>}
        {shown.map((t) => (
          <li key={t.id} className="flex items-center gap-1">
            <button type="button" onClick={() => onUse(t)} className="flex min-w-0 flex-1 flex-col rounded-md px-3 py-2 text-left hover:bg-muted">
              <span className="truncate text-14 font-medium">{t.text}</span>
              <span className="text-12 text-muted-foreground">/{t.shortcut}</span>
            </button>
            {manage && (
              <>
                <button type="button" onClick={() => setForm({ id: t.id, shortcut: t.shortcut, text: t.text, grup: t.grup })} aria-label={`Ubah /${t.shortcut}`} className="rounded-md p-2 hover:bg-muted">
                  <Pencil className="size-4" />
                </button>
                <button type="button" disabled={busy} onClick={() => remove(t.id)} aria-label={`Hapus /${t.shortcut}`} className="rounded-md p-2 text-destructive hover:bg-muted">
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
