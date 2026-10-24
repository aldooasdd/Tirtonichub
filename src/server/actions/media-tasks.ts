"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { IDX, POSTED, makeScheduler } from "@/lib/media/schedule";
import { isExpired, mine, MEMBER_STAGES } from "@/lib/media/card";
import { loadCtx, runBalance, todayWIB } from "@/server/media/schedule-runner";
import type { Task } from "@/lib/media/schedule";

export type ActionResult = { ok: boolean; message?: string };

const clamp = (v: string | null | undefined, max: number) => (v ? v.slice(0, max) : null);

async function ctxFor(id: string) {
  const authCtx = await requireMedia();
  const [acc, task, me] = await Promise.all([
    mediaAccess(authCtx),
    prisma.mediaTask.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: authCtx.userId }, select: { fullName: true } }),
  ]);
  return { authCtx, acc, task, meName: me?.fullName ?? "", today: todayWIB() };
}

/** Konversi row DB → bentuk Task util (untuk cek izin). */
function toTask(t: NonNullable<Awaited<ReturnType<typeof prisma.mediaTask.findUnique>>>): Task {
  return {
    id: t.id, itemId: t.itemId, type: t.type, status: t.status, source: t.source, reason: t.reason,
    producer: t.producer, editor: t.editor, talent: t.talent, script: t.script, shootPlan: t.shootPlan,
    editPlan: t.editPlan, postAt: t.postAt, postTime: t.postTime, due: t.due, target: t.target,
    shotAt: t.shotAt, readyAt: t.readyAt, locked: t.locked, checked: t.checked, metaAt: t.metaAt ? t.metaAt.getTime() : 0,
    caption: t.caption, srcDesc: t.srcDesc, driveUrl: t.driveUrl, note: t.note, title: t.title, cat: t.cat,
    createdAt: t.createdAt.getTime(),
  };
}

/** Pindah tahap. Member: hanya tugasnya, Terdata→Ready, sebelum metaAt. */
export async function setTaskStatus(id: string, status: string): Promise<ActionResult> {
  const { acc, task, meName, today } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  if (status === task.status) return { ok: true };
  if (IDX[status] === undefined) return { ok: false, message: "Status tidak dikenal." };
  const u = toTask(task);
  if (isExpired(u, today)) return { ok: false, message: "Konten sudah hangus (lewat 1 bulan)." };
  if (!acc.canManage) {
    if (!mine(u, acc.code) || task.metaAt || !MEMBER_STAGES.includes(task.status) || !MEMBER_STAGES.includes(status))
      return { ok: false, message: "Tidak diizinkan memindah tahap ini." };
  }
  if (status === "Tayang" && !acc.canManage) return { ok: false, message: "Hanya admin yang menandai Tayang." };
  if (status === "Ready" && POSTED.includes(task.type) && !task.driveUrl)
    return { ok: false, message: "Tempel dulu link Google Drive file final sebelum ke Ready." };

  const history = [...((task.history as unknown[]) ?? []), { at: Date.now(), name: meName, from: task.status, to: status }].slice(-30);
  const data: Record<string, unknown> = { status, history };
  if (IDX[status] >= IDX["Diproduksi"] && !task.shotAt) data.shotAt = today;
  if (IDX[status] >= IDX["Ready"] && !task.readyAt) data.readyAt = today;
  await prisma.mediaTask.update({ where: { id }, data });
  await runBalance();
  return { ok: true };
}

/** Edit field kartu. Admin: semua. Member: hanya note & driveUrl pada tugasnya. */
export async function updateTask(
  id: string,
  patch: Partial<Record<"producer" | "editor" | "talent" | "script" | "shootPlan" | "editPlan" | "postAt" | "postTime" | "locked" | "note" | "driveUrl" | "caption" | "srcDesc", string | boolean | null>>,
): Promise<ActionResult> {
  const { acc, task, today } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  const u = toTask(task);
  if (isExpired(u, today)) return { ok: false, message: "Konten sudah hangus." };

  const data: Record<string, unknown> = {};
  if (acc.canManage) {
    for (const k of ["producer", "editor", "talent", "script", "shootPlan", "editPlan", "postAt", "postTime"] as const)
      if (patch[k] !== undefined) data[k] = (patch[k] as string) || null;
    if (patch.locked !== undefined) data.locked = !!patch.locked;
    if (patch.caption !== undefined) data.caption = clamp(patch.caption as string, 2200);
    if (patch.srcDesc !== undefined) data.srcDesc = clamp(patch.srcDesc as string, 4000);
  } else {
    if (!mine(u, acc.code) || task.metaAt) return { ok: false, message: "Tidak diizinkan." };
  }
  // note & driveUrl: admin atau pemilik
  if (patch.note !== undefined) data.note = clamp(patch.note as string, 1000);
  if (patch.driveUrl !== undefined) {
    const v = ((patch.driveUrl as string) || "").trim();
    if (v && !/^https?:\/\//i.test(v)) return { ok: false, message: "Link harus diawali https://" };
    data.driveUrl = v ? v.slice(0, 500) : null;
  }
  if (!Object.keys(data).length) return { ok: true };
  await prisma.mediaTask.update({ where: { id }, data });
  // perubahan jadwal → penyeimbang
  if (["shootPlan", "editPlan", "postAt", "postTime", "locked", "producer", "editor", "talent"].some((k) => k in data)) await runBalance();
  return { ok: true };
}

/** Tandai sudah dicek Zaki (admin, status Ready, belum metaAt). */
export async function toggleCheck(id: string): Promise<ActionResult> {
  const { acc, task } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  if (!acc.canManage) return { ok: false, message: "Hanya admin." };
  if (task.status !== "Ready" || task.metaAt) return { ok: false, message: "Hanya untuk kartu Ready yang belum dijadwalkan." };
  await prisma.mediaTask.update({ where: { id }, data: { checked: !task.checked } });
  return { ok: true };
}

/** Tandai sudah dijadwalkan di Meta (admin, Ready, punya tanggal+jam tayang). */
export async function markMeta(id: string): Promise<ActionResult> {
  const { acc, task } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  if (!acc.canManage) return { ok: false, message: "Hanya admin." };
  if (task.status !== "Ready" || !POSTED.includes(task.type) || !task.postAt) return { ok: false, message: "Belum siap dijadwalkan." };
  let tm = task.postTime;
  if (!tm) {
    const sch = makeScheduler(await loadCtx());
    tm = sch.timeOf(toTask(task)) || null;
  }
  if (!tm) return { ok: false, message: "Jam tayang belum ada." };
  await prisma.mediaTask.update({ where: { id }, data: { metaAt: new Date(), postTime: tm } });
  return { ok: true };
}

/** Hapus konten (admin). */
export async function deleteTask(id: string): Promise<ActionResult> {
  const { acc, task } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  if (!acc.canManage) return { ok: false, message: "Hanya admin." };
  await prisma.mediaTask.delete({ where: { id } });
  return { ok: true };
}
