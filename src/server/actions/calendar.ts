"use server";

import { prisma } from "@/server/db";
import { requireAuth, can } from "@/server/auth/rbac";
import { clientMeta } from "@/server/request-meta";
import { logActivity } from "@/server/activity-log";

export type ActionResult = { ok: boolean; message?: string };

type Input = {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  color?: string;
  category?: string | null;
  tags?: string[];
};

export async function createCalendarEvent(input: Input): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!input.title?.trim()) return { ok: false, message: "Judul kosong." };
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return { ok: false, message: "Tanggal tidak valid." };

  await prisma.calendarEvent.create({
    data: {
      title: input.title.trim().slice(0, 200),
      description: input.description?.trim() || null,
      startTime: start,
      endTime: end,
      color: input.color || "blue",
      category: input.category?.trim() || null,
      tags: input.tags ?? [],
      createdById: ctx.userId,
    },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "create", entity: "CalendarEvent" });
  return { ok: true };
}

export async function updateCalendarEvent(
  id: string,
  patch: Partial<Input>,
): Promise<ActionResult> {
  const ctx = await requireAuth();
  const ev = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!ev) return { ok: true }; // id turunan (libur/cuti) → abaikan, refresh pulihkan
  if (ev.createdById !== ctx.userId && !can.manageEmployees(ctx.activeRole))
    return { ok: false, message: "Hanya pembuat atau HR yang bisa edit." };

  await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: String(patch.title).slice(0, 200) } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description ? String(patch.description) : null }
        : {}),
      ...(patch.startTime ? { startTime: new Date(patch.startTime) } : {}),
      ...(patch.endTime ? { endTime: new Date(patch.endTime) } : {}),
      ...(patch.color ? { color: patch.color } : {}),
      ...(patch.category !== undefined
        ? { category: patch.category ? String(patch.category) : null }
        : {}),
      ...(patch.tags ? { tags: patch.tags } : {}),
    },
  });
  return { ok: true };
}

export async function deleteCalendarEvent(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const ev = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!ev) return { ok: true }; // id turunan → abaikan
  if (ev.createdById !== ctx.userId && !can.manageEmployees(ctx.activeRole))
    return { ok: false, message: "Hanya pembuat atau HR yang bisa hapus." };
  await prisma.calendarEvent.delete({ where: { id } });
  return { ok: true };
}
