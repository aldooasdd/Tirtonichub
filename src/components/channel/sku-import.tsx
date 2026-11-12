"use client";

import { useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { applySkuImport, previewSkuImport, type SkuChange } from "@/server/actions/sku-import";

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export function SkuImport() {
  const [pending, start] = useTransition();
  const [prev, setPrev] = useState<{ changes: SkuChange[]; same: number; unknown: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set()); // baris yang TIDAK dicentang
  const toggle = (id: string) => setOff((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const pick = (f: File | undefined) =>
    f &&
    start(async () => {
      setMsg(null);
      setPrev(null);
      const r = await previewSkuImport(await toBase64(f));
      if (!r.ok) return setMsg({ ok: false, text: r.message ?? "Gagal membaca file." });
      setOff(new Set());
      setPrev(r.data!);
    });

  const save = () =>
    prev &&
    start(async () => {
      const r = await applySkuImport(prev.changes.filter((c) => !off.has(c.id)).map((c) => ({ id: c.id, to: c.to })));
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) setPrev(null);
    });

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed px-4 py-3 hover:border-foreground">
        <FileUp className="size-5" />
        <span className="flex-1 text-14">{pending && !prev ? "Membaca file…" : "Upload Excel SKU (.xlsx)"}</span>
        <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {msg && <p className={`text-14 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
      {prev && (
        <div className="space-y-2">
          <p className="text-14">
            <b>{prev.changes.length}</b> SKU berubah · {prev.same} sama{prev.unknown ? ` · ${prev.unknown} ID tidak dikenal (dilewati)` : ""}.
          </p>
          {prev.changes.length > 0 && (
            <>
              <div className="max-h-[60vh] overflow-auto rounded-lg border bg-card">
                <table className="w-full text-14">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="w-8 p-2">
                        <input
                          type="checkbox"
                          aria-label="Centang semua"
                          checked={off.size === 0}
                          onChange={() => setOff(off.size ? new Set() : new Set(prev.changes.map((c) => c.id)))}
                          className="size-4"
                        />
                      </th>
                      <th className="p-2">Nama di Tirtonichub</th>
                      <th className="p-2">Nama di Accurate</th>
                      <th className="p-2">SKU lama</th>
                      <th className="p-2">SKU baru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prev.changes.map((c) => (
                      <tr key={c.id} onClick={() => toggle(c.id)} className={`cursor-pointer border-b last:border-b-0 ${off.has(c.id) ? "opacity-40" : ""}`}>
                        <td className="p-2">
                          <input type="checkbox" checked={!off.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} aria-label={`Simpan SKU ${c.nama}`} className="size-4" />
                        </td>
                        <td className="p-2">{c.nama}</td>
                        <td className="p-2">{c.acc || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-2 font-mono text-12 text-muted-foreground">{c.from || "—"}</td>
                        <td className="p-2 font-mono text-12">{c.to || "(kosong → SKU marketplace)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={save} disabled={pending || off.size === prev.changes.length} className="h-10 rounded-md bg-primary px-4 text-14 font-semibold text-primary-foreground disabled:opacity-50">
                {pending ? "Menyimpan…" : `Simpan ${prev.changes.length - off.size} SKU yang dicentang`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
