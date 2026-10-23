"use server";

import { prisma } from "@/server/db";
import { requireAuth, can, assert } from "@/server/auth/rbac";
import { revokeSession } from "@/server/auth/session";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";

export type ActionResult = { ok: boolean; message?: string };

/** Cabut sesi aktif milik user mana pun (HR/Boss). PRD §5.5. */
export async function revokeUserSession(sessionId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.viewSessions(ctx.activeRole));
  const s = await prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (!s) return { ok: false, message: "Sesi tidak ditemukan." };
  await revokeSession(sessionId);
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "revoke", entity: "Session", entityId: sessionId, after: { userId: s.userId } });
  return { ok: true };
}
