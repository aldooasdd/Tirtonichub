"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { clientMeta } from "@/server/request-meta";
import { logActivity } from "@/server/activity-log";
import { CATS, GENDER_CATS, GENDERS, HAS_TALENT, HAS_SCRIPT, makeScheduler } from "@/lib/media/schedule";
import { loadCtx, runBalance } from "@/server/media/schedule-runner";
import type { MediaTier } from "@/generated/prisma";

export type ActionResult = { ok: boolean; message?: string };

const clean = (v: string | null | undefined, max: number): string | null =>
  v?.trim() ? v.trim().slice(0, max) : null;

/** Set kategori/gender (semua admin media) + tier/seasonal (hanya admin penuh). */
export async function updateItemMeta(
  id: string,
  fields: { cat?: string | null; gender?: string | null; tier?: MediaTier; seasonal?: boolean },
): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.canManage) return { ok: false, message: "Tidak diizinkan." };
  const item = await prisma.mediaItem.findUnique({ where: { id } });
  if (!item) return { ok: false, message: "Barang tidak ditemukan." };
  if (item.scheduled) return { ok: false, message: "Barang sudah dijadwalkan, tidak bisa diubah." };

  const cat = fields.cat != null ? (CATS[fields.cat] ? fields.cat : null) : item.cat;
  const data: Record<string, unknown> = {};
  if (fields.cat !== undefined) data.cat = cat;
  if (fields.gender !== undefined) {
    const g = fields.gender && GENDERS[fields.gender] && GENDER_CATS.includes(cat || "") ? fields.gender : null;
    data.gender = g;
  }
  // tier & seasonal (kode Louis1) hanya admin penuh
  if (fields.tier !== undefined) {
    if (!acc.full) return { ok: false, message: "Kode Louis1 hanya oleh admin penuh." };
    data.tier = fields.tier;
  }
  if (fields.seasonal !== undefined) {
    if (!acc.full) return { ok: false, message: "Kode Louis1 hanya oleh admin penuh." };
    data.seasonal = !!fields.seasonal;
  }
  await prisma.mediaItem.update({ where: { id }, data });
  return { ok: true };
}

/** Jadwalkan konten untuk satu barang: jalankan mesin penjadwalan → buat MediaTask. */
export async function scheduleItem(id: string): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.canManage) return { ok: false, message: "Tidak diizinkan." };
  const item = await prisma.mediaItem.findUnique({ where: { id } });
  if (!item) return { ok: false, message: "Barang tidak ditemukan." };
  if (item.scheduled) return { ok: false, message: "Barang sudah dijadwalkan." };
  if (!item.cat) return { ok: false, message: "Isi kategori dulu sebelum menjadwalkan." };

  const ctxData = await loadCtx();
  const sch = makeScheduler(ctxData);
  const base = item.arrived.toISOString().slice(0, 10);
  const planned = sch.planBatch(
    [{ id: item.id, cat: item.cat, tier: item.tier, qty: item.qty, seasonal: item.seasonal, arrived: base }],
    base,
  )[0];

  await prisma.$transaction([
    ...planned.tasks.map((t) =>
      prisma.mediaTask.create({
        data: {
          itemId: item.id,
          type: t.type,
          title: item.name,
          cat: item.cat,
          status: "Terdata",
          source: "baru",
          producer: t.producer || null,
          editor: t.editor || null,
          talent: HAS_TALENT(t.type) ? t.talent || null : null,
          script: HAS_SCRIPT(t.type) ? t.talent || null : null, // ponytail: skrip ikut talent; pisahkan bila perlu pool skrip
          shootPlan: t.shootPlan || null,
          editPlan: t.editPlan || null,
          postAt: t.postAt || null,
          due: t.due || null,
          target: t.target || null,
        },
      }),
    ),
    prisma.mediaItem.update({ where: { id }, data: { scheduled: true } }),
  ]);
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "schedule", entity: "MediaItem", entityId: id, after: { tasks: planned.tasks.length } });
  await runBalance();
  return { ok: true };
}

/** Hapus barang yang belum dijadwalkan (dan tugasnya bila ada). */
export async function deleteItem(id: string): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.canManage) return { ok: false, message: "Tidak diizinkan." };
  const item = await prisma.mediaItem.findUnique({ where: { id } });
  if (!item) return { ok: false, message: "Barang tidak ditemukan." };
  await prisma.$transaction([
    prisma.mediaTask.deleteMany({ where: { itemId: id } }),
    prisma.mediaItem.delete({ where: { id } }),
  ]);
  return { ok: true };
}
