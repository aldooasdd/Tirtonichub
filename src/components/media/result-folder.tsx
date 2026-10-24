"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, Download, Upload, FileText, Film } from "lucide-react";
import GlassFolder, { type FolderFile, type ArtPreset } from "@/components/ui/glass-folder-cards";

export type AssetFile = { id: string; name: string; key: string; mime: string; size: number };

const ARTS: ArtPreset[] = ["aurora", "ember", "dusk", "glacier", "verdant"];
function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function ResultFolder({
  itemId,
  name,
  photoUrl,
  assets,
  canManage,
  seed,
  appearDelay,
  width = 300,
}: {
  itemId: string;
  name: string;
  photoUrl: string | null;
  assets: AssetFile[];
  canManage: boolean;
  seed: number;
  appearDelay: number;
  width?: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const [preview, setPreview] = useState<AssetFile | null>(null);
  const [browser, setBrowser] = useState(false);
  const [hover, setHover] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  function downloadMany(list: AssetFile[]) {
    // ponytail: picu unduhan satu per satu dgn jeda agar browser tak blokir
    list.forEach((a, i) =>
      setTimeout(() => {
        const el = document.createElement("a");
        el.href = dl(a);
        el.download = a.name;
        document.body.appendChild(el);
        el.click();
        el.remove();
      }, i * 400),
    );
  }

  const files: FolderFile[] = assets.map((a) => ({
    name: a.name,
    meta: fmtSize(a.size),
    image: a.mime.startsWith("image/") ? `/api/file?key=${encodeURIComponent(a.key)}` : undefined,
  }));
  const raw = (a: AssetFile) => `/api/file?key=${encodeURIComponent(a.key)}`;
  const dl = (a: AssetFile) => `${raw(a)}&name=${encodeURIComponent(a.name)}`;

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("itemId", itemId);
    fd.append("file", f);
    const r = await fetch("/api/media/upload", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.message || "Gagal unggah.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={onPicked} />
      {/* hover → folder mengintip (open), klik → jendela Finder */}
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <GlassFolder
        key={assets.map((a) => a.id).join(",") + (busy ? ":busy" : "")}
        label={name}
        meta={busy ? "Mengunggah…" : `${assets.length} file`}
        art={photoUrl ? undefined : ARTS[seed % ARTS.length]}
        image={photoUrl ?? undefined}
        seed={seed}
        width={width}
        appearDelay={appearDelay}
        files={files}
        action={canManage ? "add" : "none"}
        open={hover}
        onOpenChange={() => setBrowser(true)}
        onAdd={() => {
          inputRef.current?.click();
          return { name: "Mengunggah…", meta: "" }; // placeholder sementara
        }}
      />
      </div>

      {browser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBrowser(false)}
        >
          {/* jendela Finder — liquid glass putih transparan */}
          <div
            className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/55 text-neutral-900 shadow-2xl backdrop-blur-2xl backdrop-saturate-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* titlebar */}
            <div className="flex items-center gap-3 border-b border-black/10 px-4 py-2.5">
              <div className="group/tl flex items-center gap-1.5">
                <button title="Tutup" onClick={() => setBrowser(false)} className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#ff5f57] text-[8px] font-bold text-black/50 hover:text-black/80">
                  <span className="opacity-0 group-hover/tl:opacity-100">✕</span>
                </button>
                <span className="h-3.5 w-3.5 rounded-full bg-[#febc2e]" />
                <span className="h-3.5 w-3.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="ml-1 flex items-center gap-1 text-black/30">
                <ChevronLeft className="h-5 w-5" />
                <ChevronRight className="h-5 w-5" />
              </div>
              <p className="flex-1 truncate text-center text-14 font-semibold">{name}</p>
              <div className="flex items-center gap-2 text-black/50">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-black/5"><LayoutGrid className="h-4 w-4" /></span>
                {canManage && (
                  <button title="Unggah" className="grid h-7 w-7 place-items-center rounded-md hover:bg-black/10" onClick={() => inputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                  </button>
                )}
                <button
                  title={sel.size ? `Unduh ${sel.size} terpilih` : "Unduh semua"}
                  className="grid h-7 w-7 place-items-center rounded-md hover:bg-black/10 disabled:opacity-40"
                  disabled={assets.length === 0}
                  onClick={() => downloadMany(sel.size ? assets.filter((a) => sel.has(a.id)) : assets)}
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* body */}
            {assets.length === 0 ? (
              <p className="py-20 text-center text-black/40">{busy ? "Mengunggah…" : "Folder kosong."}</p>
            ) : (
              <div className="grid grid-cols-3 gap-5 overflow-auto p-6 sm:grid-cols-4 md:grid-cols-5">
                {assets.map((a) => {
                  const on = sel.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleSel(a.id)}
                      onDoubleClick={() => setPreview(a)}
                      className="group flex flex-col items-center gap-1.5"
                    >
                      <div className={`grid h-24 w-24 place-items-center overflow-hidden rounded-xl ${on ? "bg-blue-500/20 ring-2 ring-blue-500" : "bg-black/5 ring-1 ring-black/10 group-hover:ring-black/30"}`}>
                        {a.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={raw(a)} alt={a.name} className="h-full w-full object-cover" />
                        ) : a.mime.startsWith("video/") ? (
                          <Film className="h-10 w-10 text-black/50" />
                        ) : (
                          <FileText className="h-10 w-10 text-black/50" />
                        )}
                      </div>
                      <p className={`max-w-24 truncate rounded px-1.5 text-12 ${on ? "bg-blue-600 text-white" : "text-neutral-800"}`}>{a.name}</p>
                      <p className="text-10 text-black/40">{fmtSize(a.size)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{preview.name}</p>
                <p className="text-12 text-muted-foreground">{fmtSize(preview.size)} · {preview.mime}</p>
              </div>
              <button className="text-14 text-muted-foreground hover:text-foreground" onClick={() => setPreview(null)}>Tutup</button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-muted">
              {preview.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={raw(preview)} alt={preview.name} className="max-h-[70vh] w-auto object-contain" />
              ) : preview.mime.startsWith("video/") ? (
                <video src={raw(preview)} controls className="max-h-[70vh] w-full" />
              ) : (
                <a href={raw(preview)} target="_blank" rel="noopener" className="p-8 text-14 text-primary underline">
                  Buka file di tab baru
                </a>
              )}
            </div>
            <a
              href={dl(preview)}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground"
            >
              Unduh
            </a>
          </div>
        </div>
      )}
    </>
  );
}
