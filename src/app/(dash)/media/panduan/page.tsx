import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { DEFAULT_JOB, TYPES } from "@/lib/media/schedule";
import { MediaPanduanClient, type JobRow } from "@/components/media/media-panduan-client";

export default async function MediaPanduanPage() {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  const s = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  const saved = (s?.jobdesk as Record<string, { prod?: string[]; tal?: string[]; edit?: string[] }> | null) ?? {};

  const jobdesk: JobRow[] = Object.keys(DEFAULT_JOB).map((t) => {
    const j = saved[t] ?? {};
    const d = DEFAULT_JOB[t];
    return {
      type: t,
      label: TYPES[t]?.label ?? t,
      prod: (j.prod?.length ? j.prod : d.prod).join(", "),
      tal: (j.tal?.length ? j.tal : d.tal).join(", "),
      edit: (j.edit?.length ? j.edit : d.edit).join(", "),
    };
  });

  return (
    <MediaPanduanClient
      full={acc.full}
      settings={{ idccDay: s?.idccDay ?? 3, idccQty: s?.idccQty ?? 10, idccDays: s?.idccDays ?? 90 }}
      jobdesk={jobdesk}
    />
  );
}
