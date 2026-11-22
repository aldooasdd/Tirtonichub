import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { NAMES } from "@/lib/media/schedule";
import { CPR_TYPES, indexCprDocs, toCprRow, type CprRow } from "@/lib/media/cpr-view";
import { todayWIB } from "@/server/media/schedule-runner";
import { briefCfgOf, PRIMARY } from "@/server/studio/brief-master";
import { CprClient } from "@/components/media/cpr-client";

/** CPR versi baru (beta, hanya baca) — dipakai /media/cpr dan /e/cpr (tertanam di Studio). Hanya admin penuh (sama dengan tab CPR). */
export async function CprView() {
  const auth = await requireMedia();
  const acc = await mediaAccess(auth);
  if (!acc.full) return <div className="p-6 text-sm text-[#73777F]">CPR hanya untuk admin penuh.</div>;
  const today = todayWIB();
  const [tasks, docs, items, settings] = await Promise.all([
    prisma.mediaTask.findMany({ where: { type: { in: CPR_TYPES } }, orderBy: { createdAt: "desc" } }),
    prisma.studioDoc.findMany({ where: { coll: "cpr" }, select: { path: true, data: true } }),
    prisma.mediaItem.findMany({ select: { id: true, thumb: true } }),
    prisma.mediaSettings.findUnique({ where: { id: 1 }, select: { extra: true } }),
  ]);
  const idx = indexCprDocs(docs);
  const thumb = new Map(items.map((i) => [i.id, i.thumb]));
  const rows = tasks.map((t) => toCprRow(t, today, idx, (t.itemId && thumb.get(t.itemId)) || null)).filter((r): r is CprRow => !!r);
  const cfg = briefCfgOf((settings?.extra as Record<string, unknown> | null)?.briefCfg);
  const labels: Record<string, string> = Object.fromEntries([...PRIMARY.map((p) => [p.id, p.l]), ...[...cfg.cobj, ...cfg.km, ...cfg.hk, ...cfg.ct, ...cfg.aud.flatMap((g) => g.o)].map((x) => [x.id, x.l])]);
  return <CprClient rows={rows} names={NAMES} labels={labels} today={today} />;
}
