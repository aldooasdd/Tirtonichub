"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { profileSelfSchema } from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string };

/** Edit profil sendiri: nickname, bio, preferensi tema (PRD §9). */
export async function updateOwnProfile(
  input: z.infer<typeof profileSelfSchema>,
): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = profileSelfSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { ip } = await clientMeta();
  await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      nickname: parsed.data.nickname ?? null,
      bio: parsed.data.bio ?? null,
      ...(parsed.data.themePref ? { themePref: parsed.data.themePref } : {}),
    },
  });
  await logActivity({ ...ctx, ip }, { action: "update", entity: "Profile", entityId: ctx.userId });
  return { ok: true };
}
