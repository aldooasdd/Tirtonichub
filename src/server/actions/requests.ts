"use server";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { requireAuth, can, assert } from "@/server/auth/rbac";
import { roleAttends } from "@/lib/roles";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { notifyBosses } from "@/server/notify";
import { REQ_TYPE_LABEL } from "@/lib/request-labels";
import { requestSchema, type RequestInput } from "@/lib/validation";

export type ActionResult = { ok: boolean; message?: string; id?: string };

const TYPE_TO_STATUS = {
  LEAVE: "LEAVE",
  PERMIT: "PERMIT",
  SICK: "SICK",
} as const;

function dayRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    out.push(new Date(t));
  }
  return out;
}

async function notify(
  tx: Prisma.TransactionClient,
  userId: string,
  n: { type: string; title: string; body?: string; link?: string },
) {
  await tx.notification.create({ data: { userId, ...n } });
}

export async function createRequest(input: RequestInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(roleAttends(ctx.activeRole)); // Boss tak mengajukan
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const d = parsed.data;
  if (d.endDate < d.startDate) return { ok: false, message: "Tanggal selesai sebelum mulai." };

  const r = await prisma.request.create({
    data: {
      userId: ctx.userId,
      type: d.type,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      reason: d.reason,
      attachmentKey: d.attachmentKey ?? null,
      payload: (d.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "create", entity: "Request", entityId: r.id, after: { type: d.type } });
  await notifyBosses({ type: "request", title: `Pengajuan ${REQ_TYPE_LABEL[d.type]} baru masuk`, link: "/hr/approval" });
  return { ok: true, id: r.id };
}

export async function cancelRequest(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r || r.userId !== ctx.userId) return { ok: false, message: "Tidak ditemukan." };
  if (r.status !== "PENDING") return { ok: false, message: "Hanya pengajuan pending bisa dibatalkan." };
  await prisma.request.update({ where: { id }, data: { status: "CANCELLED" } });
  return { ok: true };
}

export async function reviewRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string,
): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.approveRequest(ctx.activeRole));
  if (decision === "REJECTED" && !note.trim())
    return { ok: false, message: "Penolakan wajib ada catatan." };

  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) return { ok: false, message: "Tidak ditemukan." };
  if (req.status !== "PENDING") return { ok: false, message: "Pengajuan sudah diproses." };

  const { ip } = await clientMeta();

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id },
      data: {
        status: decision,
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });

    if (decision === "APPROVED") {
      if (req.type === "LEAVE" || req.type === "PERMIT" || req.type === "SICK") {
        const status = TYPE_TO_STATUS[req.type];
        for (const date of dayRange(req.startDate, req.endDate)) {
          await tx.attendance.upsert({
            where: { userId_date: { userId: req.userId, date } },
            update: { status },
            create: { userId: req.userId, date, status },
          });
        }
      } else if (req.type === "ATTENDANCE_CORRECTION") {
        // koreksi: terapkan payload persis ke hari itu (§11.11)
        const p = (req.payload ?? {}) as {
          checkInAt?: string;
          checkOutAt?: string;
          status?: "ON_TIME" | "LATE";
        };
        await tx.attendance.upsert({
          where: { userId_date: { userId: req.userId, date: req.startDate } },
          update: {
            ...(p.checkInAt ? { checkInAt: new Date(p.checkInAt) } : {}),
            ...(p.checkOutAt ? { checkOutAt: new Date(p.checkOutAt) } : {}),
            ...(p.status ? { status: p.status } : {}),
          },
          create: {
            userId: req.userId,
            date: req.startDate,
            status: p.status ?? "ON_TIME",
            checkInAt: p.checkInAt ? new Date(p.checkInAt) : null,
            checkOutAt: p.checkOutAt ? new Date(p.checkOutAt) : null,
          },
        });
      }
    }

    await notify(tx, req.userId, {
      type: "request",
      title: `Pengajuan ${decision === "APPROVED" ? "disetujui" : "ditolak"}`,
      body: note || undefined,
      link: "/pengajuan",
    });
    await logActivity(
      { ...ctx, ip },
      { action: decision === "APPROVED" ? "approve" : "reject", entity: "Request", entityId: id },
      tx,
    );
  });

  return { ok: true };
}
