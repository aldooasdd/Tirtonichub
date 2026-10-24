import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { MediaIdccClient } from "@/components/media/media-idcc-client";

type Barang = { id: string; nama: string };
type Hasil = { id: string; rekomendasi: string; prioritas: number; alasan: string; ide_konten: string };

export default async function MediaIdccPage() {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  const report = await prisma.mediaIdccReport.findFirst({ orderBy: { createdAt: "desc" } });
  const data = (report?.data as { barang?: Barang[]; hasil?: Hasil[] } | null) ?? null;
  const nameOf = new Map((data?.barang ?? []).map((b) => [b.id, b.nama]));

  return (
    <MediaIdccClient
      canRun={acc.idcc}
      summary={report?.summary ?? null}
      reportAt={report ? report.createdAt.toISOString().slice(0, 10) : null}
      rows={(data?.hasil ?? []).map((h) => ({ ...h, nama: nameOf.get(h.id) ?? h.id })).sort((a, b) => a.prioritas - b.prioritas)}
    />
  );
}
