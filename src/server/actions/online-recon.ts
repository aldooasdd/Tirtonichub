"use server";

import { prisma } from "@/server/db";
import { requireFinance } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { ONLINE_CHANNELS, type OnlineChannel } from "@/lib/online-recon";

/** Finance: simpan nominal uang asli satu kanal online untuk satu bulan. */
export async function saveOnlineRecon(month: string, channel: string, actual: number, note: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireFinance();
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: "Bulan tidak valid." };
  if (!ONLINE_CHANNELS.includes(channel as OnlineChannel)) return { ok: false, message: "Kanal tidak valid." };
  const amount = Math.max(0, Math.round(actual) || 0);
  const data = { actual: amount, note: note?.trim().slice(0, 300) || null, updatedById: ctx.userId };
  await prisma.onlineRecon.upsert({
    where: { month_channel: { month, channel } },
    create: { month, channel, ...data },
    update: data,
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "online_recon", entity: "OnlineRecon", entityId: `${month}:${channel}`, after: { actual: amount } });
  return { ok: true };
}
