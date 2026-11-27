"use client";

import { useState } from "react";
import type { WebFormKategori } from "@/server/marketplace/website";

// Data tambahan produk tirtonic.com (filter shop, spesifikasi, skor Tirtoniclab) di balik centang
// "Barang ini punya data". Dipakai form Produk web baru & form Tambah Produk (tujuan tirtonic.com).
const field = "h-9 w-full rounded-md border bg-background px-2 text-14";
const label = "text-12 font-medium text-muted-foreground";
const card = "space-y-3 rounded-lg border bg-card p-4";
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-12 ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`;
const angka = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));

export function useWebData(k: WebFormKategori | undefined) {
  const [atribut, setAtribut] = useState<Record<string, string[]>>({});
  const [lain, setLain] = useState<Record<string, string>>({});
  const [spek, setSpek] = useState<Record<string, string>>({});
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [skor, setSkor] = useState("");
  const [punyaData, setPunyaData] = useState(false);
  const toggle = (key: string, v: string) =>
    setAtribut((a) => ({ ...a, [key]: (a[key] ?? []).includes(v) ? a[key].filter((x) => x !== v) : [...(a[key] ?? []), v] }));

  /** Data yang dikirim ke tirtonic.com; kosong kalau "punya data" tidak dicentang. */
  const payload = () => {
    if (!punyaData || !k) return { atribut: {}, spek: {}, nilai: {}, skor: null };
    return {
      atribut: Object.fromEntries(k.atribut.map((a) => [a.key, [...(atribut[a.key] ?? []), ...(lain[a.key] ?? "").split(",").map((x) => x.trim()).filter(Boolean)]])),
      spek: Object.fromEntries(k.spek.map((s) => [s.label, spek[s.label] ?? ""])),
      nilai: Object.fromEntries(k.kriteria.map((c) => [c, angka(nilai[c] ?? "")]).filter((x): x is [string, number] => x[1] != null)),
      skor: angka(skor),
    };
  };
  const reset = () => { setAtribut({}); setLain({}); };

  const ui = (
    <>
      {k && (k.atribut.length > 0 || k.spek.length > 0 || k.kriteria.length > 0) && (
        <label className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <input type="checkbox" className="mt-1" checked={punyaData} onChange={(e) => setPunyaData(e.target.checked)} />
          <span>
            <span className="block text-14 font-medium">Barang ini punya data</span>
            <span className="block text-12 text-muted-foreground">Centang untuk mengisi filter shop, spesifikasi, dan skor Tirtoniclab. Kalau tidak, filter ditebak otomatis dari nama.</span>
          </span>
        </label>
      )}

      {punyaData && k && k.atribut.length > 0 && (
        <section className={card}>
          <div>
            <h2 className="text-16 font-semibold">Filter di shop</h2>
            <p className="text-12 text-muted-foreground">Pilih yang sesuai supaya produk muncul saat pembeli menyaring. Kosong = ditebak otomatis dari nama.</p>
          </div>
          {k.atribut.map((a) => (
            <div key={a.key} className="space-y-1.5">
              <p className={label}>{a.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {a.opsi.map((o) => <button key={o} type="button" className={chip((atribut[a.key] ?? []).includes(o))} onClick={() => toggle(a.key, o)}>{o}</button>)}
                <input className="h-7 w-40 rounded-full border bg-background px-3 text-12" value={lain[a.key] ?? ""} onChange={(e) => setLain((x) => ({ ...x, [a.key]: e.target.value }))} placeholder="Lainnya, pisah koma" />
              </div>
            </div>
          ))}
        </section>
      )}

      {punyaData && k && k.spek.length > 0 && (
        <section className={card}>
          <h2 className="text-16 font-semibold">Spesifikasi</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {k.spek.map((s) => (
              <label key={s.label} className="space-y-1">
                <span className={label}>{s.label}</span>
                <input className={field} value={spek[s.label] ?? ""} onChange={(e) => setSpek((x) => ({ ...x, [s.label]: e.target.value }))} placeholder={s.contoh} />
              </label>
            ))}
          </div>
        </section>
      )}

      {punyaData && k && k.kriteria.length > 0 && (
        <section className={card}>
          <div>
            <h2 className="text-16 font-semibold">Skor Tirtoniclab (opsional)</h2>
            <p className="text-12 text-muted-foreground">Nilai 0–100 dari hasil uji lab dan playtest. Dipakai filter skor, Compare, dan Match.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="space-y-1"><span className={label}>Skor total</span><input className={field} inputMode="numeric" value={skor} onChange={(e) => setSkor(e.target.value)} /></label>
            {k.kriteria.map((c) => (
              <label key={c} className="space-y-1">
                <span className={label}>{c}</span>
                <input className={field} inputMode="numeric" value={nilai[c] ?? ""} onChange={(e) => setNilai((x) => ({ ...x, [c]: e.target.value }))} />
              </label>
            ))}
          </div>
        </section>
      )}
    </>
  );
  return { ui, payload, reset };
}
