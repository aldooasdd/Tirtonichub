"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { boostItem, deleteShopeeItem, replyReview, unlistItem, updateShopeeItem } from "@/server/actions/shopee-product";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-12 font-medium hover:bg-muted disabled:opacity-50";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, q?: string, after?: () => void) => {
    if (q && !confirm(q)) return;
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  };
  const note = msg && <p className={`text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>;
  return { pending, act, note };
}

/** Balas ulasan pembeli. */
export function ReviewReply({ id }: { id: string }) {
  const { pending, act, note } = useAct();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button className={btn} onClick={() => setOpen(true)}>
        Balas
      </button>
    );
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={500} autoFocus className="w-full rounded-md border bg-background p-2 text-14" />
      <div className="flex gap-2">
        <button className={btn} disabled={pending || !text.trim()} onClick={() => act(() => replyReview(id, text), undefined, () => setOpen(false))}>
          Kirim balasan
        </button>
        <button className={btn} onClick={() => setOpen(false)}>Batal</button>
      </div>
      {note}
    </div>
  );
}

/** Naikkan produk + (bila saklar nyala) arsip/tampilkan, ubah nama/deskripsi, hapus. */
export function ShopeeItemOps({ itemId, cooldown, writable, unlisted, name }: { itemId: string; cooldown: number; writable: boolean; unlisted: boolean; name: string }) {
  const { pending, act, note } = useAct();
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(name);
  const [desc, setDesc] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={pending || cooldown > 0} onClick={() => act(() => boostItem(itemId), "Naikkan produk ini di Shopee? (jeda 4 jam per produk)")}>
          {cooldown > 0 ? `Naikkan (tunggu ${Math.ceil(cooldown / 60)} mnt)` : "Naikkan produk"}
        </button>
        {writable && (
          <>
            <button className={btn} disabled={pending} onClick={() => act(() => unlistItem(itemId, !unlisted), unlisted ? "Tampilkan lagi di Shopee?" : "Arsipkan (sembunyikan) produk ini di Shopee?")}>
              {unlisted ? "Tampilkan di Shopee" : "Arsipkan di Shopee"}
            </button>
            <button className={btn} onClick={() => setEdit(!edit)}>Ubah nama/deskripsi di Shopee</button>
            <button className={`${btn} text-destructive`} disabled={pending} onClick={() => act(() => deleteShopeeItem(itemId), "HAPUS produk ini dari Shopee? Tidak bisa dikembalikan.")}>
              Hapus dari Shopee
            </button>
          </>
        )}
      </div>
      {writable && edit && (
        <div className="space-y-2 rounded-md border p-3">
          <input value={n} onChange={(e) => setN(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-14" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Deskripsi baru (kosong = tidak diubah)" className="w-full rounded-md border bg-background p-2 text-14" />
          <button
            className={btn}
            disabled={pending || (n.trim() === name && !desc.trim())}
            onClick={() => act(() => updateShopeeItem(itemId, { name: n.trim() !== name ? n.trim() : undefined, description: desc.trim() || undefined }), "Simpan perubahan ke Shopee?", () => setEdit(false))}
          >
            Simpan ke Shopee
          </button>
        </div>
      )}
      {note}
    </div>
  );
}
