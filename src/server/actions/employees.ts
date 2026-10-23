"use server";

import type { Prisma, RoleCode } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireHr, can } from "@/server/auth/rbac";
import { revokeAllSessions } from "@/server/auth/session";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { employeeSchema, type EmployeeInput } from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string; id?: string };

/** Jumlah akun Boss aktif. Jaga invariant "minimal 1 Boss aktif" (PRD §3). */
async function activeBossCount(
  tx: Prisma.TransactionClient,
  excludeUserId?: string,
): Promise<number> {
  return tx.user.count({
    where: {
      isActive: true,
      id: excludeUserId ? { not: excludeUserId } : undefined,
      roles: { some: { role: { code: "BOSS" } } },
    },
  });
}

async function roleIdMap(): Promise<Record<RoleCode, string>> {
  const roles = await prisma.role.findMany();
  return Object.fromEntries(roles.map((r) => [r.code, r.id])) as Record<RoleCode, string>;
}

export async function createEmployee(input: EmployeeInput): Promise<ActionResult> {
  const ctx = await requireHr();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;

  // anti-eskalasi: tiap role yang diberikan harus boleh diatur oleh user ini
  for (const code of data.roleCodes) {
    if (!can.assignRole(ctx, code, "__new__")) {
      return { ok: false, message: `Kamu tidak boleh memberi role ${code}.` };
    }
  }

  const map = await roleIdMap();
  const { ip } = await clientMeta();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          waNumber: data.waNumber,
          branchId: data.branchId ?? null,
          joinedAt: data.joinedAt ?? null,
        },
      });
      await tx.userRole.createMany({
        data: data.roleCodes.map((code) => ({
          userId: u.id,
          roleId: map[code],
          assignedById: ctx.userId,
        })),
      });
      if (data.scheduleId) {
        await tx.userSchedule.create({
          data: { userId: u.id, scheduleId: data.scheduleId, effectiveFrom: new Date() },
        });
      }
      await logActivity(
        { ...ctx, ip },
        { action: "create", entity: "User", entityId: u.id, after: { email: u.email, roles: data.roleCodes } },
        tx,
      );
      return u;
    });
    return { ok: true, id: user.id };
  } catch (e) {
    return { ok: false, message: conflictMsg(e) };
  }
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput,
): Promise<ActionResult> {
  const ctx = await requireHr();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!existing) return { ok: false, message: "Karyawan tidak ditemukan." };

  const current = new Set(existing.roles.map((r) => r.role.code));
  const desired = new Set(data.roleCodes);
  const added = [...desired].filter((c) => !current.has(c));
  const removed = [...current].filter((c) => !desired.has(c));

  for (const code of [...added, ...removed]) {
    if (!can.assignRole(ctx, code, id)) {
      return { ok: false, message: `Kamu tidak boleh mengubah role ${code}.` };
    }
  }

  const map = await roleIdMap();
  const { ip } = await clientMeta();

  try {
    await prisma.$transaction(async (tx) => {
      // invariant Boss terakhir
      if (removed.includes("BOSS") && (await activeBossCount(tx, id)) < 1) {
        throw new Error("BOSS_LAST");
      }
      await tx.user.update({
        where: { id },
        data: {
          fullName: data.fullName,
          email: data.email,
          waNumber: data.waNumber,
          branchId: data.branchId ?? null,
          joinedAt: data.joinedAt ?? null,
        },
      });
      if (removed.length) {
        await tx.userRole.deleteMany({
          where: { userId: id, role: { code: { in: removed } } },
        });
      }
      if (added.length) {
        await tx.userRole.createMany({
          data: added.map((code) => ({ userId: id, roleId: map[code], assignedById: ctx.userId })),
        });
      }
      await logActivity(
        { ...ctx, ip },
        {
          action: "update",
          entity: "User",
          entityId: id,
          before: { roles: [...current] },
          after: { roles: [...desired] },
        },
        tx,
      );
    });
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Error && e.message === "BOSS_LAST") {
      return { ok: false, message: "Tidak bisa mencabut role Boss terakhir yang aktif." };
    }
    return { ok: false, message: conflictMsg(e) };
  }
}

export async function setEmployeeActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireHr();
  const { ip } = await clientMeta();
  try {
    await prisma.$transaction(async (tx) => {
      if (!active && (await activeBossCount(tx, id)) < 1) {
        // user ini satu-satunya Boss aktif?
        const isBoss = await tx.user.findFirst({
          where: { id, roles: { some: { role: { code: "BOSS" } } } },
          select: { id: true },
        });
        if (isBoss) throw new Error("BOSS_LAST");
      }
      await tx.user.update({ where: { id }, data: { isActive: active } });
      await logActivity(
        { ...ctx, ip },
        { action: active ? "activate" : "deactivate", entity: "User", entityId: id },
        tx,
      );
    });
    if (!active) await revokeAllSessions(id); // cabut semua sesi (PRD §5.4)
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Error && e.message === "BOSS_LAST") {
      return { ok: false, message: "Tidak bisa menonaktifkan Boss terakhir yang aktif." };
    }
    return { ok: false, message: "Gagal mengubah status." };
  }
}

function conflictMsg(e: unknown): string {
  if (
    e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  ) {
    const target = (e as { meta?: { target?: string[] } }).meta?.target?.join(", ") ?? "";
    if (target.includes("email")) return "Email sudah dipakai.";
    if (target.includes("waNumber")) return "Nomor WA sudah dipakai.";
    return "Data sudah dipakai.";
  }
  return "Gagal menyimpan data.";
}
