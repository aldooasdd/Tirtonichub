"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { IDX, POSTED, makeScheduler } from "@/lib/media/schedule";
import { isExpired, pausedOf, mine, MEMBER_STAGES } from "@/lib/media/card";
import { loadCtx, runBalance, todayWIB } from "@/server/media/schedule-runner";
import type { Task } from "@/lib/media/schedule";
import type { Prisma } from "@/generated/prisma";
import { nextPlanLog } from "@/server/studio/plan-log";
import { qaAutoSubmit, qaBlocks, qaCfgOf, qaReopen } from "@/server/studio/cpr";
import { briefBlocks } from "@/server/studio/brief";
import { getRaw } from "@/server/studio/store";
import { taskEvents } from "@/server/automation/events";
import { kickAutomation, outboxCreate } from "@/server/automation/worker";
import { queueEditNotif } from "@/server/push/edit";

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
    createdAt: t.createdAt.getTime(), pausedMs: pausedOf(t.extra),
  };
}

/** CPR: kartu ber-QA tidak boleh Tayang / dijadwalkan di Meta sebelum QA lolos (sama dengan Studio, cpr.ts). */
function qaWhy(task: { status: string; metaAt: Date | null; extra: unknown }, next: { status?: string; metaAt?: boolean }) {
  const ex = (task.extra && typeof task.extra === "object" ? task.extra : {}) as Record<string, unknown>;
  const before = { status: task.status, metaAt: task.metaAt ? 1 : 0 };
  return qaBlocks(before, { qaReq: ex.qaReq, qa: ex.qa, status: next.status ?? task.status, metaAt: next.metaAt || before.metaAt });
}

/** Standar Creative Review yang tersimpan (settings/main.qaCfg). */
const qaCfgNow = async () => qaCfgOf((await getRaw("settings/main"))?.qaCfg);

/** Bentuk ringkas kartu untuk menurunkan event otomasi (events.ts). */
function evDoc(t: Record<string, unknown>): Record<string, unknown> {
  const ex = (t.extra && typeof t.extra === "object" ? t.extra : {}) as Record<string, unknown>;
  return { type: t.type, status: t.status, producer: t.producer, editor: t.editor, readyBy: ex.readyBy, due: t.due, postAt: t.postAt, campaignId: ex.campaignId, brief: ex.brief, qa: ex.qa };
}
/** Simpan perubahan kartu dari dasbor + event otomasi dalam satu transaksi. */
async function saveTask(id: string, task: Record<string, unknown>, data: Record<string, unknown>) {
  const evs = taskEvents(id, evDoc(task), evDoc({ ...task, ...data }));
  if (evs.length) await prisma.$transaction([prisma.mediaTask.update({ where: { id }, data }), outboxCreate(evs)]);
  else await prisma.mediaTask.update({ where: { id }, data });
  if (evs.length) kickAutomation();
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
  const qa = qaWhy(task, { status });
  if (qa) return { ok: false, message: qa + "." };
  const exB = (task.extra && typeof task.extra === "object" ? task.extra : {}) as Record<string, unknown>;
  const br = briefBlocks({ status: task.status }, { status, type: task.type, briefReq: exB.briefReq, brief: exB.brief });
  if (br) return { ok: false, message: br + "." };
  if (status === "Ready" && POSTED.includes(task.type) && !task.driveUrl)
    return { ok: false, message: "Tempel dulu link Google Drive file final sebelum ke Ready." };

  const history = [...((task.history as unknown[]) ?? []), { at: Date.now(), name: meName, from: task.status, to: status }].slice(-30);
  const data: Record<string, unknown> = { status, history };
  if (IDX[status] >= IDX["Diproduksi"] && !task.shotAt) data.shotAt = today;
  if (IDX[status] >= IDX["Ready"] && !task.readyAt) data.readyAt = today;
  // masuk Ready → Creative Review diajukan otomatis (sama dengan Studio, cpr.ts qaAutoSubmit)
  const auto = qaAutoSubmit({ status: task.status, driveUrl: task.driveUrl }, { ...exB, type: task.type, cprId: task.cprId, status, driveUrl: task.driveUrl }, meName, await qaCfgNow());
  if (auto) data.extra = { ...exB, qa: auto } as Prisma.InputJsonValue;
  await saveTask(id, task as unknown as Record<string, unknown>, data);
  await queueEditNotif(id, task as unknown as Record<string, unknown>, { ...task, ...data }, meName, acc.code ?? "");
  await runBalance();
  return { ok: true };
}

/** Edit field kartu. Admin: semua. Member: hanya note & driveUrl pada tugasnya. */
export async function updateTask(
  id: string,
  patch: Partial<Record<"producer" | "editor" | "talent" | "script" | "shootPlan" | "editPlan" | "postAt" | "postTime" | "locked" | "note" | "driveUrl" | "caption" | "srcDesc", string | boolean | null>>,
): Promise<ActionResult> {
  const { acc, task, today, meName } = await ctxFor(id);
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
  // Riwayat jadwal (sama dengan Studio, plan-log.ts): catat perubahan Rencana syuting/edit dari dasbor.
  if ("shootPlan" in data || "editPlan" in data) {
    const ex = task.extra && typeof task.extra === "object" && !Array.isArray(task.extra) ? (task.extra as Record<string, unknown>) : {};
    const log = nextPlanLog(ex.planLog, task, { ...task, ...data }, meName, "dasbor");
    if (log) data.extra = { ...ex, planLog: log } as Prisma.InputJsonValue;
  }
  // file final berubah setelah QA diajukan/Approved → QA dibuka kembali (sama dengan Studio, cpr.ts)
  if ("driveUrl" in data) {
    const ex = (data.extra ?? (task.extra && typeof task.extra === "object" && !Array.isArray(task.extra) ? task.extra : {})) as Record<string, unknown>;
    const r = qaReopen(ex.qa, { driveUrl: task.driveUrl }, { driveUrl: data.driveUrl }, meName);
    if (r) data.extra = { ...ex, qa: r } as Prisma.InputJsonValue;
    const cur = (data.extra ?? ex) as Record<string, unknown>;
    const auto = qaAutoSubmit({ status: task.status, driveUrl: task.driveUrl }, { ...cur, type: task.type, cprId: task.cprId, status: task.status, driveUrl: data.driveUrl }, meName, await qaCfgNow());
    if (auto) data.extra = { ...cur, qa: auto } as Prisma.InputJsonValue;
  }
  await saveTask(id, task as unknown as Record<string, unknown>, data);
  await queueEditNotif(id, task as unknown as Record<string, unknown>, { ...task, ...data }, meName, acc.code ?? "");
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
  const qa = qaWhy(task, { metaAt: true });
  if (qa) return { ok: false, message: qa + "." };
  await prisma.mediaTask.update({ where: { id }, data: { metaAt: new Date(), postTime: tm } });
  return { ok: true };
}

/** Buat caption Instagram dengan AI (admin). Simpan caption + deskripsi sumber. */
export async function generateCaption(id: string, srcDesc: string): Promise<ActionResult & { caption?: string }> {
  const { acc, task } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  if (!acc.canManage) return { ok: false, message: "Hanya admin." };
  const { aiCaption } = await import("@/server/media/ai");
  const { TYPES, CATLBL, GENDERS } = await import("@/lib/media/schedule");
  const item = task.itemId ? await prisma.mediaItem.findUnique({ where: { id: task.itemId } }) : null;
  try {
    const r = await aiCaption({
      nama: task.title,
      jenis_konten: TYPES[task.type]?.label ?? task.type,
      kategori: task.cat ? CATLBL[task.cat] ?? task.cat : "",
      gender: item?.gender ? GENDERS[item.gender] ?? "" : "",
      catatan: task.note ?? "",
      deskripsi: srcDesc,
    });
    const base = r.hashtag.length ? `${r.caption}\n\n${r.hashtag.map((h) => "#" + h).join(" ")}` : r.caption;
    const { captionTemplate } = await import("@/lib/media/caption-templates");
    const tpl = captionTemplate(task.type, task.cat);
    const caption = tpl ? `${base}\n\n${tpl}` : base;
    await prisma.mediaTask.update({ where: { id }, data: { caption: caption.slice(0, 2200), srcDesc: srcDesc.slice(0, 4000) } });
    return { ok: true, caption };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "AI gagal." };
  }
}

/** Hapus konten (admin). */
export async function deleteTask(id: string): Promise<ActionResult> {
  const { acc, task } = await ctxFor(id);
  if (!task) return { ok: false, message: "Tugas tidak ditemukan." };
  if (!acc.canManage) return { ok: false, message: "Hanya admin." };
  await prisma.mediaTask.delete({ where: { id } });
  return { ok: true };
}
