"use server";

import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/rbac";

export async function markNotifRead(id: string): Promise<{ ok: boolean }> {
  const ctx = await requireAuth();
  await prisma.notification.updateMany({
    where: { id, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function markAllNotifRead(): Promise<{ ok: boolean }> {
  const ctx = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}
