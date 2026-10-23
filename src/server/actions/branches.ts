"use server";

import { prisma } from "@/server/db";
import { requireAuth, can, assert } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { branchSchema, type BranchInput } from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string; id?: string };

export async function createBranch(input: BranchInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.manageBranchSchedule(ctx.activeRole));
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { ip } = await clientMeta();
  try {
    const b = await prisma.branch.create({ data: parsed.data });
    await logActivity({ ...ctx, ip }, { action: "create", entity: "Branch", entityId: b.id, after: parsed.data });
    return { ok: true, id: b.id };
  } catch {
    return { ok: false, message: "Nama cabang sudah dipakai." };
  }
}

export async function updateBranch(id: string, input: BranchInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.manageBranchSchedule(ctx.activeRole));
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { ip } = await clientMeta();
  try {
    await prisma.branch.update({ where: { id }, data: parsed.data });
    await logActivity({ ...ctx, ip }, { action: "update", entity: "Branch", entityId: id, after: parsed.data });
    return { ok: true, id };
  } catch {
    return { ok: false, message: "Gagal menyimpan cabang." };
  }
}

export async function deleteBranch(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.manageBranchSchedule(ctx.activeRole));
  const count = await prisma.user.count({ where: { branchId: id } });
  if (count > 0) return { ok: false, message: "Cabang masih punya karyawan, tak bisa dihapus." };
  const { ip } = await clientMeta();
  await prisma.branch.delete({ where: { id } });
  await logActivity({ ...ctx, ip }, { action: "delete", entity: "Branch", entityId: id });
  return { ok: true };
}
