"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { PEOPLE, DEFAULT_JOB } from "@/lib/media/schedule";

export type ActionResult = { ok: boolean; message?: string };

type Jobdesk = Record<string, { prod?: string[]; tal?: string[]; edit?: string[] }>;

const codes = (arr: string[]) => [...new Set(arr.map((c) => c.trim().toUpperCase()).filter((c) => (PEOPLE as readonly string[]).includes(c)))];

/** Simpan pengaturan media (hanya admin penuh). */
export async function saveSettings(f: { idccDay: number; idccQty: number; idccDays: number; jobdesk?: Jobdesk }): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.full) return { ok: false, message: "Hanya admin penuh." };

  const idccDay = Math.min(6, Math.max(0, Math.round(f.idccDay)));
  const idccQty = Math.max(1, Math.round(f.idccQty) || 10);
  const idccDays = Math.max(1, Math.round(f.idccDays) || 90);

  let jobdesk: Jobdesk | undefined;
  if (f.jobdesk) {
    jobdesk = {};
    for (const t of Object.keys(DEFAULT_JOB)) {
      const j = f.jobdesk[t];
      if (!j) continue;
      jobdesk[t] = { prod: codes(j.prod ?? []), tal: codes(j.tal ?? []), edit: codes(j.edit ?? []) };
    }
  }

  await prisma.mediaSettings.upsert({
    where: { id: 1 },
    update: { idccDay, idccQty, idccDays, ...(jobdesk ? { jobdesk } : {}) },
    create: { id: 1, idccDay, idccQty, idccDays, jobdesk: jobdesk ?? undefined },
  });
  return { ok: true };
}
