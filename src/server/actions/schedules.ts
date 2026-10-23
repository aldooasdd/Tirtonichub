"use server";

import { prisma } from "@/server/db";
import { requireAuth, can, assert } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import {
  scheduleSchema,
  holidaySchema,
  type ScheduleInput,
  type HolidayInput,
} from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string; id?: string };

async function guard() {
  const ctx = await requireAuth();
  assert(can.manageBranchSchedule(ctx.activeRole));
  return ctx;
}

export async function createSchedule(input: ScheduleInput): Promise<ActionResult> {
  const ctx = await guard();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { ip } = await clientMeta();
  const s = await prisma.workSchedule.create({ data: parsed.data });
  await logActivity({ ...ctx, ip }, { action: "create", entity: "WorkSchedule", entityId: s.id });
  return { ok: true, id: s.id };
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<ActionResult> {
  const ctx = await guard();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { ip } = await clientMeta();
  await prisma.workSchedule.update({ where: { id }, data: parsed.data });
  await logActivity({ ...ctx, ip }, { action: "update", entity: "WorkSchedule", entityId: id });
  return { ok: true, id };
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  const ctx = await guard();
  const used = await prisma.userSchedule.count({ where: { scheduleId: id } });
  if (used > 0) return { ok: false, message: "Jadwal masih dipakai karyawan." };
  const { ip } = await clientMeta();
  await prisma.workSchedule.delete({ where: { id } });
  await logActivity({ ...ctx, ip }, { action: "delete", entity: "WorkSchedule", entityId: id });
  return { ok: true };
}

/** Assign jadwal ke karyawan mulai tanggal tertentu (riwayat lama tak berubah). §7.4 */
export async function assignSchedule(
  userId: string,
  scheduleId: string,
  effectiveFrom: string,
): Promise<ActionResult> {
  const ctx = await guard();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom))
    return { ok: false, message: "Tanggal tidak valid." };
  const { ip } = await clientMeta();
  await prisma.userSchedule.create({
    data: { userId, scheduleId, effectiveFrom: new Date(effectiveFrom) },
  });
  await logActivity({ ...ctx, ip }, { action: "assign_schedule", entity: "UserSchedule", entityId: userId });
  return { ok: true };
}

export async function createHoliday(input: HolidayInput): Promise<ActionResult> {
  const ctx = await guard();
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { ip } = await clientMeta();
  try {
    const h = await prisma.holiday.create({
      data: { date: new Date(parsed.data.date), name: parsed.data.name },
    });
    await logActivity({ ...ctx, ip }, { action: "create", entity: "Holiday", entityId: h.id });
    return { ok: true, id: h.id };
  } catch {
    return { ok: false, message: "Tanggal libur itu sudah ada." };
  }
}

export async function deleteHoliday(id: string): Promise<ActionResult> {
  const ctx = await guard();
  const { ip } = await clientMeta();
  await prisma.holiday.delete({ where: { id } });
  await logActivity({ ...ctx, ip }, { action: "delete", entity: "Holiday", entityId: id });
  return { ok: true };
}
