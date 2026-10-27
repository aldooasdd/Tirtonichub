"use server";

import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";

/** Tandai sesi masih aktif (dipanggil berkala dari tab yang terbuka). */
export async function heartbeat(): Promise<void> {
  const s = await getSession();
  if (!s) return;
  await prisma.session
    .update({ where: { id: s.sessionId }, data: { lastActiveAt: new Date() } })
    .catch(() => {});
}
