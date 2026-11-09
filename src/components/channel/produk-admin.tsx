"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { renameProduct, restoreProduct, trashProduct } from "@/server/actions/produk-master";

/** Judul produk + ubah nama, hapus ke Sampah / pulihkan. Hanya di Tirtonichub. */
export function ProdukAdmin({ platform, itemId, title, deleted }: { platform: string; itemId: string; title: string; deleted: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(title);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const btn = "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-12 font-medium disabled:opacity-40";
  return (
    <div className="space-y-2">
      {deleted && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">Produk ini ada di Sampah, tidak tampil di Produk Master.</p>}
      {edit ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renameProduct(platform, itemId, name), () => setEdit(false));
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Nama produk" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-16" />
          <button type="submit" disabled={pending || name.trim() === title} className="h-10 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-40">
            Simpan
          </button>
          <button type="button" onClick={() => { setEdit(false); setName(title); }} className="h-10 rounded-md border px-3 text-14">
            Batal
          </button>
        </form>
      ) : (
        <h1 className="text-24 font-semibold">{title}</h1>
      )}
      <div className="flex flex-wrap gap-2">
        {!edit && !deleted && (
          <button type="button" onClick={() => setEdit(true)} className={btn}>
            <Pencil className="size-3.5" /> Ubah nama
          </button>
        )}
        {deleted ? (
          <button type="button" disabled={pending} onClick={() => run(() => restoreProduct(platform, itemId))} className={`${btn} text-emerald-600`}>
            <RotateCcw className="size-3.5" /> Pulihkan
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm("Pindahkan produk ini ke Sampah? Bisa dipulihkan lagi.") && run(() => trashProduct(platform, itemId), () => router.push("/channel/produk"))}
            className={`${btn} text-destructive`}
          >
            <Trash2 className="size-3.5" /> Hapus
          </button>
        )}
      </div>
      {msg && <p className={`text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
      <p className="text-12 text-muted-foreground">Nama ikut diubah di Shopee, Tokopedia & Tirtonic.com. SKU & hapus hanya di Tirtonichub.</p>
    </div>
  );
}
