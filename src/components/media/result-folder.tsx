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

  const files: FolderFile[] = assets.map((a) => {
    const dl = `/api/file?key=${encodeURIComponent(a.key)}&name=${encodeURIComponent(a.name)}`;
    const isImg = a.mime.startsWith("image/");
    return {
      name: a.name,
      meta: fmtSize(a.size),
      href: dl,
      image: isImg ? `/api/file?key=${encodeURIComponent(a.key)}` : undefined,
    };
  });

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
        onAdd={() => {
          inputRef.current?.click();
          return { name: "Mengunggah…", meta: "" }; // placeholder sementara
        }}
      />
    </>
  );
}
