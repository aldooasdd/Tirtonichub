"use client";

import { useRef, useState } from "react";
import { pairTags } from "@/server/actions/rfid";

type Varian = { label: string; sku: string; tags: number };

/** RFID di Draft produk: pilih varian (SKU) + cabang → sapu stiker, tiap tag langsung terpasang. Reader = keyboard (kode + Enter). */
export function DraftRfid({ varian, cabang }: { varian: Varian[]; cabang: { id: string; label: string }[] }) {
  const [sku, setSku] = useState(varian[0]?.sku ?? "");
  const [branch, setBranch] = useState(() => (cabang.find((c) => /jogja|yogya/i.test(c.label)) ?? cabang[0])?.id ?? "");
  const [count, setCount] = useState<Record<string, number>>(() => Object.fromEntries(varian.map((v) => [v.sku, v.tags])));
  const [msg, setMsg] = useState("");
  const antre = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = (target: string, cab: string) => {
    const epcs = antre.current.splice(0);
    if (!epcs.length) return;
    pairTags(epcs, target, cab)
      .then((r) => {
        setCount((c) => ({ ...c, [target]: r.tagList.length }));
        setMsg(r.other.length ? `${r.other.length} tag sudah milik barang lain: ${r.other.map((o) => o.name).join(", ")}. Pakai stiker lain.` : "");
      })
      .catch(() => setMsg("Gagal menyimpan tag. Cek koneksi lalu sapu lagi."));
  };

  if (!varian.length) return <p className="text-14 text-muted-foreground">Isi SKU varian di atas lalu klik Simpan draft, baru RFID bisa dipasang.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {varian.map((v) => (
          <button key={v.sku} type="button" onClick={() => { clearTimeout(timer.current); flush(sku, branch); setSku(v.sku); }} className={`rounded-md border px-3 py-1.5 text-14 ${sku === v.sku ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {v.label} · <span className="font-mono">{v.sku}</span> · {count[v.sku] ?? 0} tag
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-14">
          {cabang.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input
          inputMode="none"
          placeholder="Klik di sini lalu sapu stiker RFID"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const v = e.currentTarget.value.trim().toUpperCase();
            e.currentTarget.value = "";
            if (!/^[0-9A-F]{24,32}$/.test(v) || !sku || !branch) return;
            antre.current.push(v);
            clearTimeout(timer.current);
            const t = sku, b = branch;
            timer.current = setTimeout(() => flush(t, b), 300);
          }}
          className="h-10 min-w-60 flex-1 rounded-md border bg-background px-3 text-14"
        />
      </div>
      {msg && <p role="alert" className="text-14 text-destructive">{msg}</p>}
    </div>
  );
}
