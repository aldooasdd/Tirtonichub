"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { deletePosCampaign, togglePosCampaign, uploadPosCampaign } from "@/server/actions/pos";

type Campaign = { id: string; title: string; url: string; isVideo: boolean; branch: string; active: boolean };

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/** Kelola campaign layar depan kasir (layar pembeli iMin D4-504: 10.1", 1280×800). */
export function PosCampaigns({ campaigns, branches }: { campaigns: Campaign[]; branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [branchId, setBranchId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(f: File | null) {
    setMsg(null);
    setFile(f);
    setSize(null);
    if (preview) URL.revokeObjectURL(preview);
    const u = f ? URL.createObjectURL(f) : null;
    setPreview(u);
    if (!f || !u) return;
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    // Cek ukuran asli supaya pas di layar 1280×800.
    if (f.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.onloadedmetadata = () => setSize(`${v.videoWidth}×${v.videoHeight}`);
      v.src = u;
    } else {
      const i = new Image();
      i.onload = () => setSize(`${i.naturalWidth}×${i.naturalHeight}`);
      i.src = u;
    }
  }

  function upload() {
    if (!file) return;
    start(async () => {
      const r = await uploadPosCampaign({ title, base64: await toBase64(file), mime: file.type, branchId: branchId || null });
      if (!r.ok) return setMsg(r.message ?? "Gagal upload.");
      choose(null);
      setTitle("");
      router.refresh();
    });
  }

  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  const [w, h] = size?.split("×").map(Number) ?? [];
  const ratioOk = !size || Math.abs(w / h - 1.6) < 0.02;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-16 font-semibold">Campaign layar depan</h2>
        <p className="text-14 text-muted-foreground">
          Tampil bergantian di layar pembeli saat kasir tidak sedang transaksi. Buka di layar depan: <code>/pos/layar</code>.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-14">
            <p className="font-semibold">Ukuran: 1280 × 800 px (landscape 16:10)</p>
            <p className="text-muted-foreground">Layar pembeli iMin D4-504, 10.1&quot;. Boleh lebih besar asal 16:10, mis. 1920 × 1200 / 2560 × 1600.</p>
            <p className="text-muted-foreground">Gambar JPG / PNG / WebP maks 5 MB · Video MP4 maks 20 MB (tanpa suara).</p>
            <p className="text-muted-foreground">Taruh teks & logo penting minimal 60 px dari tepi.</p>
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={(e) => choose(e.target.files?.[0] ?? null)} className="block text-14" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul campaign (mis. Promo Senar November)" className="h-10 w-full rounded-md border px-3 text-14" />
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-10 w-full rounded-md border px-3 text-14">
            <option value="">Semua cabang</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {msg && <p className="text-14 text-destructive">{msg}</p>}
          <button disabled={!file || pending} onClick={upload} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-14 font-semibold text-primary-foreground disabled:opacity-50">
            <Upload className="h-4 w-4" /> {pending ? "Mengunggah…" : "Upload"}
          </button>
        </div>
        <div className="space-y-1.5">
          <div className="aspect-[16/10] overflow-hidden rounded-md bg-[#1a1a1a]">
            {preview && (file?.type.startsWith("video/") ? (
              <video src={preview} muted autoPlay loop playsInline className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
          <p className={`text-12 ${ratioOk ? "text-muted-foreground" : "text-warning"}`}>
            {size ? `File: ${size} px${ratioOk ? " · pas 16:10" : " · bukan 16:10, tepi akan terpotong"}` : "Pratinjau tampilan di layar pembeli"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {campaigns.map((c) => (
          <div key={c.id} className={`overflow-hidden rounded-lg border bg-card ${c.active ? "" : "opacity-50"}`}>
            <div className="aspect-[16/10] bg-[#1a1a1a]">
              {c.isVideo ? (
                <video src={c.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- media campaign dari storage
                <img src={c.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-14 font-medium">{c.title}</p>
              <p className="text-12 text-muted-foreground">{c.branch}{c.isVideo ? " · video" : ""}</p>
              <div className="flex items-center justify-between pt-1">
                <button onClick={() => act(() => togglePosCampaign(c.id, !c.active))} className="text-14 text-primary underline">
                  {c.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button onClick={() => confirm(`Hapus "${c.title}"?`) && act(() => deletePosCampaign(c.id))} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="col-span-full text-14 text-muted-foreground">Belum ada campaign.</p>}
      </div>
    </section>
  );
}
