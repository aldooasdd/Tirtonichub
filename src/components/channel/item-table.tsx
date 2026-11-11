"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateChannelItem } from "@/server/actions/channel";
import { setItemSku, trashListing, trashVariant } from "@/server/actions/produk-master";
import { Trash2 } from "lucide-react";
import { fmtInt, parseInt0 } from "@/lib/money-input";
import { bolehUbah } from "@/lib/flags";

const TOKO: Record<string, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Tirtonic.com" };
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
import { RupiahInput } from "@/components/ui/rupiah-input";

export type ItemRow = { id: string; platform: string; demo: boolean; name: string; sku: string | null; price: number; stock: number; image?: string | null; inactive?: boolean };

/** Produk marketplace: ubah stok & harga per baris → langsung dikirim ke Shopee / Tokopedia. */
export function ItemTable({ rows }: { rows: ItemRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { stock: String(r.stock), price: r.price }])));
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [sku, setSku] = useState(() => Object.fromEntries(rows.map((r) => [r.id, r.sku ?? ""])));

  function saveSku(r: ItemRow) {
    if (sku[r.id] === (r.sku ?? "")) return;
    start(async () => {
      const res = await setItemSku(r.id, sku[r.id]).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg((m) => ({ ...m, [r.id]: { ok: res.ok, text: res.message ?? "" } }));
      if (res.ok) router.refresh();
    });
  }

  function save(r: ItemRow) {
    const d = draft[r.id];
    start(async () => {
      const res = await updateChannelItem(r.id, Number(d.stock) || 0, d.price).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg((m) => ({ ...m, [r.id]: { ok: res.ok, text: res.message ?? (res.ok ? "Tersimpan." : "Gagal.") } }));
      if (res.ok) router.refresh();
    });
  }

  function trash(r: ItemRow) {
    if (!confirm(`Hapus varian "${r.name}" dari Tirtonichub? Di marketplace tidak ikut terhapus. Bisa dipulihkan dari Sampah.`)) return;
    start(async () => {
      const res = await trashVariant(r.id).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      if (!res.ok) return setMsg((m) => ({ ...m, [r.id]: { ok: false, text: res.message ?? "Gagal." } }));
      router.refresh();
    });
  }

  if (rows.length === 0) return <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada produk. Sinkron toko dulu.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-14">
        <thead>
          <tr className="border-b bg-card text-left text-muted-foreground">
            <th className="p-3">Toko</th>
            <th className="p-3">Produk</th>
            <th className="p-3">SKU</th>
            <th className="p-3">Stok</th>
            <th className="p-3">Harga (Rp)</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = draft[r.id];
            const changed = d.stock !== String(r.stock) || d.price !== r.price;
            return (
              <tr key={r.id} className="border-b align-top last:border-b-0">
                <td className="p-3 whitespace-nowrap">
                  {TOKO[r.platform] ?? r.platform}
                  {r.demo && <span className="ml-1 text-12 text-amber-600">contoh</span>}
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    {r.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- foto varian dari CDN marketplace
                      <img src={r.image} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
                    )}
                    <span>
                      {r.name}
                      {r.inactive && <span className="ml-1 text-12 text-muted-foreground">(nonaktif)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => trash(r)}
                      disabled={pending}
                      title="Hapus varian (dobel)"
                      aria-label={`Hapus varian ${r.name}`}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </td>
                <td className="p-3">
                  <input
                    value={sku[r.id]}
                    onChange={(e) => setSku({ ...sku, [r.id]: e.target.value })}
                    onBlur={() => saveSku(r)}
                    // Scanner barcode (seperti QC) mengetik kode lalu Enter → simpan & lompat ke baris berikutnya.
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const all = [...document.querySelectorAll<HTMLInputElement>("input[data-sku]")];
                      const next = all[all.indexOf(e.currentTarget) + 1];
                      if (next) next.focus();
                      else e.currentTarget.blur();
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    data-sku
                    placeholder="Scan / ketik SKU"
                    aria-label={`SKU ${r.name}`}
                    title="Ubah SKU (hanya di Tirtonichub). Kosongkan untuk kembali ke SKU marketplace."
                    className="h-9 w-36 rounded-md border bg-background px-2 font-mono text-12"
                  />
                  {!bolehUbah(r.platform) && msg[r.id] && <p className={msg[r.id].ok ? "mt-1 text-12 text-emerald-600" : "mt-1 text-12 text-destructive"}>{msg[r.id].text}</p>}
                </td>
                {!bolehUbah(r.platform) ? (
                  <>
                    <td className={`p-3 tabular-nums ${r.stock === 0 ? "font-semibold text-destructive" : ""}`}>{r.stock}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums">{rupiah(r.price)}</td>
                    <td className="p-3" />
                  </>
                ) : (
                <>
                <td className="p-3">
                  <input
                    inputMode="numeric"
                    value={d.stock}
                    onChange={(e) => setDraft({ ...draft, [r.id]: { ...d, stock: e.target.value.replace(/\D/g, "") } })}
                    aria-label={`Stok ${r.name}`}
                    className={`h-9 w-20 rounded-md border bg-background px-2 text-right text-14 ${Number(d.stock) === 0 ? "border-destructive" : ""}`}
                  />
                </td>
                <td className="p-3">
                  <RupiahInput plain
                    inputMode="numeric"
                    value={fmtInt(d.price)}
                    onChange={(e) => setDraft({ ...draft, [r.id]: { ...d, price: parseInt0(e.target.value) } })}
                    aria-label={`Harga ${r.name}`}
                    className="h-9 w-32 rounded-md border bg-background px-2 text-right text-14"
                  />
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => save(r)}
                    disabled={pending || !changed}
                    className="h-9 rounded-md bg-primary px-3 text-14 font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Simpan
                  </button>
                  {msg[r.id] && <p className={msg[r.id].ok ? "mt-1 text-12 text-emerald-600" : "mt-1 text-12 text-destructive"}>{msg[r.id].text}</p>}
                </td>
                </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tombol di judul "Harga & stok di …": hapus semua varian listing ini sekaligus. */
export function TrashListingButton({ platform, itemId, count }: { platform: string; itemId: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || count === 0}
      onClick={() =>
        confirm(`Hapus semua ${count} varian ${TOKO[platform] ?? platform} ini dari Tirtonichub? Di marketplace tidak ikut terhapus. Bisa dipulihkan dari Sampah.`) &&
        start(async () => {
          const r = await trashListing(platform, itemId).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
          if (!r.ok) alert(r.message);
          router.refresh();
        })
      }
      className="ml-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 align-middle text-14 font-normal text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-40"
    >
      <Trash2 className="size-4" /> {pending ? "Menghapus…" : "Hapus semua"}
    </button>
  );
}
