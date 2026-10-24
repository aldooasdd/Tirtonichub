"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
      {/* key berubah saat daftar file berubah → folder remount & tampilkan list baru */}
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
        onFileSelect={(_f, i) => setPreview(assets[i] ?? null)}
        onAdd={() => {
          inputRef.current?.click();
          return { name: "Mengunggah…", meta: "" }; // placeholder sementara
        }}
      />

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
