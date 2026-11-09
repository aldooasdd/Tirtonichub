"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateChannelItem } from "@/server/actions/channel";
import { fmtInt, parseInt0 } from "@/lib/money-input";
import { RupiahInput } from "@/components/ui/rupiah-input";

export type ItemRow = { id: string; platform: string; demo: boolean; name: string; sku: string | null; price: number; stock: number; image?: string | null; inactive?: boolean };

/** Produk marketplace: ubah stok & harga per baris → langsung dikirim ke Shopee / Tokopedia. */
export function ItemTable({ rows }: { rows: ItemRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { stock: String(r.stock), price: r.price }])));
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  function save(r: ItemRow) {
    const d = draft[r.id];
    start(async () => {
      const res = await updateChannelItem(r.id, Number(d.stock) || 0, d.price).catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg((m) => ({ ...m, [r.id]: { ok: res.ok, text: res.message ?? (res.ok ? "Tersimpan." : "Gagal.") } }));
      if (res.ok) router.refresh();
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
                  {r.platform === "SHOPEE" ? "Shopee" : "Tokopedia"}
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
                  </span>
                </td>
                <td className="p-3 font-mono text-12">{r.sku ?? "-"}</td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
