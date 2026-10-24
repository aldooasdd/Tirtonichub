"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATLBL, GENDERS, GENDER_CATS, LOUIS, tierLbl } from "@/lib/media/schedule";
import { updateItemMeta, scheduleItem, deleteItem } from "@/server/actions/media-items";
import type { MediaTier } from "@/generated/prisma";

type Item = {
  id: string;
  name: string;
  color: string | null;
  cat: string | null;
  gender: string | null;
  qty: number;
  tier: MediaTier;
  seasonal: boolean;
  scheduled: boolean;
  arrived: string;
  photo: string | null;
};

const CAT_KEYS = Object.keys(CATLBL);
const selCls = "h-9 rounded-md border bg-background px-2 text-14";

export function MediaBarangClient({ items, canManage, full }: { items: Item[]; canManage: boolean; full: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // draft kategori/gender/tier/seasonal per barang (default dari data)
  const [draft, setDraft] = useState<Record<string, Partial<Item>>>({});
  const v = <K extends keyof Item>(i: Item, k: K): Item[K] => (draft[i.id]?.[k] as Item[K]) ?? i[k];
  const set = (id: string, k: keyof Item, val: unknown) => setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: val } }));

  function save(i: Item, thenSchedule: boolean) {
    start(async () => {
      const r = await updateItemMeta(i.id, {
        cat: v(i, "cat"),
        gender: v(i, "gender"),
        ...(full ? { tier: v(i, "tier"), seasonal: v(i, "seasonal") } : {}),
      });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      if (thenSchedule) {
        const s = await scheduleItem(i.id);
        if (!s.ok) {
          alert(s.message);
          return;
        }
      }
      router.refresh();
    });
  }
  function remove(i: Item) {
    if (!confirm(`Hapus barang "${i.name}"?`)) return;
    start(async () => {
      const r = await deleteItem(i.id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  const pendingItems = items.filter((i) => !i.scheduled);
  const doneItems = items.filter((i) => i.scheduled);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Barang</h1>
        <p className="text-14 text-muted-foreground">Barang masuk otomatis dari produk yang lolos QC. Isi kategori{full ? " & kode Louis1" : ""} lalu jadwalkan kontennya.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-14 font-medium text-muted-foreground">Belum dijadwalkan ({pendingItems.length})</h2>
        {pendingItems.length === 0 && (
          <p className="rounded-lg border bg-card py-8 text-center text-muted-foreground">Tidak ada barang menunggu.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pendingItems.map((i) => (
          <div key={i.id} className="overflow-hidden rounded-lg border bg-card">
            <div className="relative h-40 w-full bg-gradient-to-br from-sky-200 via-violet-200 to-fuchsia-200">
              {i.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photo} alt={i.name} className="h-full w-full object-cover" />
              )}
              {i.color && (
                <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                  <span className="rounded-md bg-white/85 px-2 py-0.5 text-12 font-medium text-foreground backdrop-blur">{i.color}</span>
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{i.name}</p>
                <p className="text-12 text-muted-foreground">
                  {[`${i.qty} pcs`, `datang ${i.arrived}`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            {canManage ? (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-12 text-muted-foreground">Kategori</span>
                    <select className={selCls} value={v(i, "cat") ?? ""} onChange={(e) => set(i.id, "cat", e.target.value || null)}>
                      <option value="">Pilih…</option>
                      {CAT_KEYS.map((k) => (
                        <option key={k} value={k}>{CATLBL[k]}</option>
                      ))}
                    </select>
                  </label>
                  {GENDER_CATS.includes(v(i, "cat") ?? "") && (
                    <label className="flex flex-col gap-1">
                      <span className="text-12 text-muted-foreground">Gender ukuran</span>
                      <select className={selCls} value={v(i, "gender") ?? ""} onChange={(e) => set(i.id, "gender", e.target.value || null)}>
                        <option value="">Pilih…</option>
                        {Object.entries(GENDERS).map(([k, l]) => (
                          <option key={k} value={k}>{l}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {full && (
                    <div className="flex flex-col gap-1">
                      <span className="text-12 text-muted-foreground">Kode Louis1</span>
                      <div className="flex gap-1">
                        {(["EX", "LS", "JP"] as MediaTier[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => set(i.id, "tier", t)}
                            className={`h-9 rounded-md border px-3 text-14 ${v(i, "tier") === t ? "bg-primary text-primary-foreground" : "bg-background"}`}
                            title={LOUIS[t].n}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {full && (v(i, "tier") === "EX" || v(i, "tier") === "LS") && (
                    <label className="flex items-center gap-2 pb-2 text-14">
                      <input type="checkbox" checked={!!v(i, "seasonal")} onChange={(e) => set(i.id, "seasonal", e.target.checked)} />
                      Musiman
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={pending} onClick={() => save(i, true)}>Jadwalkan konten</Button>
                  <Button variant="outline" disabled={pending} onClick={() => save(i, false)}>Simpan</Button>
                  <Button variant="outline" disabled={pending} onClick={() => remove(i)}>Hapus</Button>
                </div>
              </>
            ) : (
              <p className="text-12 text-muted-foreground">Menunggu admin media mengkategorikan & menjadwalkan.</p>
            )}
            </div>
          </div>
        ))}
        </div>
      </section>

      {doneItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-14 font-medium text-muted-foreground">Sudah dijadwalkan ({doneItems.length})</h2>
          <div className="rounded-lg border bg-card divide-y">
            {doneItems.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-12 text-muted-foreground">{[i.color, i.cat ? CATLBL[i.cat] : null, `${i.qty} pcs`].filter(Boolean).join(" · ")}</p>
                </div>
                <Badge variant="secondary">{tierLbl({ id: i.id, tier: i.tier, qty: i.qty })}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
