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
  const [browser, setBrowser] = useState(false);
  const [hover, setHover] = useState(false);

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setBrowser(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <p className="truncate font-medium">{name}</p>
              <div className="flex items-center gap-3">
                {canManage && (
                  <button className="text-14 text-primary" onClick={() => inputRef.current?.click()}>
                    {busy ? "Mengunggah…" : "+ Unggah"}
                  </button>
                )}
                <button className="text-14 text-muted-foreground hover:text-foreground" onClick={() => setBrowser(false)}>Tutup</button>
              </div>
            </div>
            {assets.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground">Folder kosong.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 md:grid-cols-4">
                {assets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setPreview(a)}
                    className="flex flex-col overflow-hidden rounded-lg border bg-background text-left hover:border-primary"
                  >
                    <div className="flex h-24 items-center justify-center bg-muted">
                      {a.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={raw(a)} alt={a.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-30">{a.mime.startsWith("video/") ? "🎬" : "📄"}</span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-12 font-medium">{a.name}</p>
                      <p className="text-11 text-muted-foreground">{fmtSize(a.size)}</p>
                    </div>
                  </button>
                ))}
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
