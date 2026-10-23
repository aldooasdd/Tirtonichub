import type { Prisma, RoleCode } from "@prisma/client";
import { prisma } from "@/server/db";

type LogInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string | null;
};

/** Catat perubahan data (PRD §7.7). Dipakai di dalam/berdekatan transaksi mutasi. */
export async function logActivity(
  ctx: { userId: string; activeRole: RoleCode; ip?: string | null },
  input: LogInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await tx.activityLog.create({
    data: {
      actorId: ctx.userId,
      actorRole: ctx.activeRole,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      ip: input.ip ?? ctx.ip ?? null,
    },
  });
}
