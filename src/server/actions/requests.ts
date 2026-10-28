"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { requireAuth, can, assert } from "@/server/auth/rbac";
import { roleAttends } from "@/lib/roles";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { notifyBosses } from "@/server/notify";
import { REQ_TYPE_LABEL } from "@/lib/request-labels";
import { requestSchema, type RequestInput } from "@/lib/validation";
import { effectiveShiftCode } from "@/server/attendance/shift-schedule";

export type ActionResult = { ok: boolean; message?: string; id?: string };

const TYPE_TO_STATUS = {
  LEAVE: "LEAVE",
  PERMIT: "PERMIT",
  SICK: "SICK",
} as const;

// Pengajuan yang butuh pengganti setuju dulu (koreksi absen tak perlu).
const NEEDS_COVER: string[] = ["LEAVE", "PERMIT", "SICK", "SHIFT_SWAP"];

// Kode shift di jadwal saat pengajuan disetujui.
const TYPE_TO_SHIFT = { LEAVE: "CUTI", PERMIT: "IZIN", SICK: "SAKIT" } as const;

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

  // Semua pengajuan (cuti/izin/sakit/tukar) wajib ada pengganti; pengganti setuju dulu baru HR approve.
  let payload = (d.payload ?? undefined) as Prisma.InputJsonValue | undefined;
  let counterpartId: string | null = null;
  if (NEEDS_COVER.includes(d.type)) {
    const cid = (d.payload as { counterpartId?: string } | null)?.counterpartId;
    if (!cid || cid === ctx.userId) return { ok: false, message: "Pilih karyawan pengganti." };
    const cp = await prisma.user.findFirst({ where: { id: cid, isActive: true }, select: { id: true } });
    if (!cp) return { ok: false, message: "Pengganti tidak ditemukan." };
    counterpartId = cid;
    payload = { ...((d.payload as object) ?? {}), counterpartId, counterpartApproved: false };
  }

  const r = await prisma.request.create({
    data: {
      userId: ctx.userId,
      type: d.type,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      reason: d.reason,
      attachmentKey: d.attachmentKey ?? null,
      payload,
    },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "create", entity: "Request", entityId: r.id, after: { type: d.type } });
  if (counterpartId) {
    // minta persetujuan pengganti dulu (bukan HR)
    await prisma.notification.create({
      data: { userId: counterpartId, type: "request", title: `Minta jadi pengganti: ${REQ_TYPE_LABEL[d.type]}`, body: `Tanggal ${d.startDate}`, link: "/pengajuan" },
    });
  } else {
    await notifyBosses({ type: "request", title: `Pengajuan ${REQ_TYPE_LABEL[d.type]} baru masuk`, link: "/hr/approval" });
  }
  return { ok: true, id: r.id };
}

/** Pengganti menyetujui / menolak permintaan (cuti/izin/sakit/tukar). Setuju → lanjut ke HR. */
export async function respondRequest(id: string, agree: boolean): Promise<ActionResult> {
  const ctx = await requireAuth();
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r) return { ok: false, message: "Tidak ditemukan." };
  if (r.status !== "PENDING") return { ok: false, message: "Sudah diproses." };
  const p = (r.payload ?? {}) as { counterpartId?: string; counterpartApproved?: boolean };
  if (p.counterpartId !== ctx.userId) return { ok: false, message: "Bukan permintaan untukmu." };
  if (p.counterpartApproved) return { ok: false, message: "Sudah kamu setujui." };

  if (!agree) {
    await prisma.request.update({ where: { id }, data: { status: "REJECTED", reviewNote: "Pengganti menolak" } });
    await prisma.notification.create({ data: { userId: r.userId, type: "request", title: "Pengajuan ditolak pengganti", link: "/pengajuan" } });
    return { ok: true };
  }
  await prisma.request.update({ where: { id }, data: { payload: { ...p, counterpartApproved: true } as Prisma.InputJsonValue } });
  await prisma.notification.create({ data: { userId: r.userId, type: "request", title: "Pengganti setuju, menunggu HR", link: "/pengajuan" } });
  await notifyBosses({ type: "request", title: "Pengajuan siap di-approve (pengganti setuju)", link: "/hr/approval" });
  return { ok: true };
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
  if (decision === "APPROVED") {
    const p = (req.payload ?? {}) as { counterpartId?: string; counterpartApproved?: boolean };
    if (p.counterpartId && !p.counterpartApproved)
      return { ok: false, message: "Pengganti belum setuju. Tak bisa di-approve." };
  }

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
        const code = TYPE_TO_SHIFT[req.type];
        const coverId = (req.payload as { counterpartId?: string } | null)?.counterpartId;
        for (const date of dayRange(req.startDate, req.endDate)) {
          await tx.attendance.upsert({
            where: { userId_date: { userId: req.userId, date } },
            update: { status },
            create: { userId: req.userId, date, status },
          });
          // jadwal pemohon auto jadi CUTI/IZIN/SAKIT
          await tx.shift.upsert({
            where: { userId_date: { userId: req.userId, date } },
            update: { code },
            create: { userId: req.userId, date, code },
          });
          // pengganti auto jadi long shift (gantiin seharian)
          if (coverId)
            await tx.shift.upsert({
              where: { userId_date: { userId: coverId, date } },
              update: { code: "LONG" },
              create: { userId: coverId, date, code: "LONG" },
            });
        }
      } else if (req.type === "SHIFT_SWAP") {
        // tukar shift: kedua pihak saling tukar kode shift di tanggal itu
        const p = (req.payload ?? {}) as { counterpartId?: string };
        const D = req.startDate;
        const [reqUser, cpUser] = await Promise.all([
          tx.user.findUniqueOrThrow({ where: { id: req.userId }, select: { id: true, fullName: true } }),
          tx.user.findUniqueOrThrow({ where: { id: p.counterpartId! }, select: { id: true, fullName: true } }),
        ]);
        const [rCode, cCode] = await Promise.all([effectiveShiftCode(reqUser, D), effectiveShiftCode(cpUser, D)]);
        await tx.shift.upsert({ where: { userId_date: { userId: reqUser.id, date: D } }, update: { code: cCode }, create: { userId: reqUser.id, date: D, code: cCode } });
        await tx.shift.upsert({ where: { userId_date: { userId: cpUser.id, date: D } }, update: { code: rCode }, create: { userId: cpUser.id, date: D, code: rCode } });
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

  revalidatePath("/beranda"); // jadwal/absen karyawan ikut keputusan terbaru
  revalidatePath("/hr/jadwal");
  return { ok: true };
}
