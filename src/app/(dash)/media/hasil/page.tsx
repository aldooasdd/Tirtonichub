import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { fileUrl } from "@/server/storage";
import { ResultFolder } from "@/components/media/result-folder";

export default async function MediaHasilPage() {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  const items = await prisma.mediaItem.findMany({
    orderBy: { arrived: "desc" },
    take: 200,
    include: { assets: { orderBy: { createdAt: "desc" } } },
  });
  const photos = await Promise.all(items.map((i) => (i.photoKey ? fileUrl(i.photoKey) : Promise.resolve(null))));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Hasil Konten</h1>
        <p className="text-14 text-muted-foreground">Unggah file hasil konten per barang. Klik folder untuk buka, klik file untuk unduh.</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">Belum ada barang.</p>
      ) : (
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          {items.map((it, idx) => (
            <ResultFolder
              key={it.id}
              itemId={it.id}
              name={it.name}
              photoUrl={photos[idx]}
              seed={idx + 3}
              appearDelay={(idx % 3) * 120}
              width={220}
              canManage={acc.canManage}
              assets={it.assets.map((a) => ({ id: a.id, name: a.name, key: a.key, mime: a.mime, size: a.size }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
