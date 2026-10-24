import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { fileUrl } from "@/server/storage";
import { MediaBarangClient } from "@/components/media/media-barang-client";

export default async function MediaBarangPage() {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  const rows = await prisma.mediaItem.findMany({
    orderBy: [{ scheduled: "asc" }, { arrived: "desc" }],
    take: 200,
  });
  const photos = await Promise.all(rows.map((i) => (i.photoKey ? fileUrl(i.photoKey) : Promise.resolve(null))));

  return (
    <MediaBarangClient
      canManage={acc.canManage}
      full={acc.full}
      items={rows.map((i, idx) => ({
        id: i.id,
        name: i.name,
        color: i.color,
        cat: i.cat,
        gender: i.gender,
        qty: i.qty,
        tier: i.tier,
        seasonal: i.seasonal,
        scheduled: i.scheduled,
        arrived: i.arrived.toISOString().slice(0, 10),
        photo: photos[idx],
      }))}
    />
  );
}
