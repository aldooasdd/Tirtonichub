"use server";

import { prisma } from "@/server/db";
import { requireAuth, assert } from "@/server/auth/rbac";
import { roleAttends } from "@/lib/roles";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { dateKeyWIB, computeCheckInStatus, withinRadius, wibMinutesOfDay, parseHHMM } from "@/server/attendance/logic";
import { shiftScheduleFor } from "@/server/attendance/shift-schedule";

export type ActionResult = { ok: boolean; message?: string };

const MAX_PHOTO = 500 * 1024; // 500 KB
const RADIUS_M = Number(process.env.ATTENDANCE_RADIUS_METERS) || 0;
const LATE_TOLERANCE_MIN = Number(process.env.ATTENDANCE_LATE_TOLERANCE_MIN) || 5;
const MEDIA_MIN_WORK_MS = 5 * 3600_000; // Media: min 5 jam sebelum boleh absen pulang

type Geo = { lat: number; lng: number; accuracy: number };

function parseForm(form: FormData): { photo: File; geo: Geo } | { error: string } {
  const photo = form.get("photo");
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const accuracy = Number(form.get("accuracy"));
  if (!(photo instanceof File)) return { error: "Foto wajib." };
  if (photo.size > MAX_PHOTO) return { error: "Foto terlalu besar (maks 500KB)." };
  if (!photo.type.startsWith("image/")) return { error: "Foto harus gambar." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy))
    return { error: "Lokasi wajib." };
  return { photo, geo: { lat, lng, accuracy } };
}

async function checkRadiusOrFail(branchId: string | null, geo: Geo): Promise<string | null> {
  if (!RADIUS_M || !branchId) return null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch || branch.latitude == null || branch.longitude == null) return null; // tak bisa validasi
  const { ok, distance } = withinRadius(geo, { lat: branch.latitude, lng: branch.longitude }, RADIUS_M);
  if (!ok) return `Kamu ${Math.round(distance)}m dari cabang (maks ${RADIUS_M}m). Absen ditolak.`;
  return null;
}

export async function checkIn(form: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(roleAttends(ctx.activeRole)); // Boss tak absen

  const parsed = parseForm(form);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const { photo, geo } = parsed;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  const now = new Date();
  const dateKey = dateKeyWIB(now);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: ctx.userId, date: dateKey } },
  });
  if (existing?.checkInAt) return { ok: false, message: "Kamu sudah absen masuk hari ini." };

  // Media: jadwal fleksibel (tak ada shift tetap) → selalu boleh masuk, tak dihitung telat.
  let status: "ON_TIME" | "LATE" = "ON_TIME";
  let lateMinutes = 0;
  if (ctx.activeRole !== "MEDIA") {
    const schedule = await shiftScheduleFor(user, dateKey);
    if (!schedule)
      return { ok: false, message: "Hari ini kamu tidak ada jadwal kerja (libur/cuti/WFH). Tak perlu absen." };
    ({ status, lateMinutes } = computeCheckInStatus(now, {
      startTime: schedule.start,
      lateToleranceMin: LATE_TOLERANCE_MIN,
    }));
  }

  const radiusErr = await checkRadiusOrFail(user.branchId, geo);
  if (radiusErr) return { ok: false, message: radiusErr };

  const key = makeKey(`attendance/${ctx.userId}`, "jpg");
  await putObject(key, Buffer.from(await photo.arrayBuffer()), photo.type);
  const { ip } = await clientMeta();

  await prisma.attendance.upsert({
    where: { userId_date: { userId: ctx.userId, date: dateKey } },
    update: {
      checkInAt: now,
      checkInPhotoKey: key,
      checkInLat: geo.lat,
      checkInLng: geo.lng,
      checkInAccuracy: geo.accuracy,
      status,
      lateMinutes,
      branchId: user.branchId,
    },
    create: {
      userId: ctx.userId,
      date: dateKey,
      branchId: user.branchId,
      checkInAt: now,
      checkInPhotoKey: key,
      checkInLat: geo.lat,
      checkInLng: geo.lng,
      checkInAccuracy: geo.accuracy,
      status,
      lateMinutes,
    },
  });
  await logActivity({ ...ctx, ip }, { action: "check_in", entity: "Attendance", after: { status } });
  return { ok: true, message: status === "LATE" ? `Absen masuk — Terlambat ${lateMinutes} menit.` : "Absen masuk — Tepat waktu." };
}

export async function checkOut(form: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(roleAttends(ctx.activeRole));

  const parsed = parseForm(form);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const { photo, geo } = parsed;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  const now = new Date();
  const dateKey = dateKeyWIB(now);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: ctx.userId, date: dateKey } },
  });
  if (!existing?.checkInAt)
    return { ok: false, message: "Belum absen masuk. Pakai pengajuan koreksi bila lupa." };
  if (existing.checkOutAt) return { ok: false, message: "Kamu sudah absen pulang hari ini." };

  if (ctx.activeRole === "MEDIA") {
    // Media: absen pulang hanya setelah 5 jam kerja.
    if (now.getTime() - existing.checkInAt.getTime() < MEDIA_MIN_WORK_MS)
      return { ok: false, message: "Belum 5 jam kerja. Belum bisa absen pulang." };
  } else {
    const schedule = await shiftScheduleFor(user, dateKey);
    if (schedule && wibMinutesOfDay(now) < parseHHMM(schedule.end))
      return { ok: false, message: `Absen pulang bisa setelah shift berakhir (${schedule.end}).` };
  }

  // Hanya perwakilan (yang buka saldo kasir) wajib tutup dulu sebelum pulang. Sales lain bebas.
  if (ctx.activeRole === "SALES" && user.branchId) {
    const sess = await prisma.cashSession.findUnique({
      where: { branchId_date: { branchId: user.branchId, date: dateKey } },
    });
    if (sess && sess.openedById === ctx.userId && !sess.closedAt)
      return { ok: false, message: "Kamu yang buka saldo kasir — tutup saldo (saldo akhir) dulu sebelum pulang." };
  }

  const radiusErr = await checkRadiusOrFail(user.branchId, geo);
  if (radiusErr) return { ok: false, message: radiusErr };

  const key = makeKey(`attendance/${ctx.userId}`, "jpg");
  await putObject(key, Buffer.from(await photo.arrayBuffer()), photo.type);
  const { ip } = await clientMeta();

  await prisma.attendance.update({
    where: { userId_date: { userId: ctx.userId, date: dateKey } },
    data: {
      checkOutAt: now,
      checkOutPhotoKey: key,
      checkOutLat: geo.lat,
      checkOutLng: geo.lng,
      checkOutAccuracy: geo.accuracy,
    },
  });
  await logActivity({ ...ctx, ip }, { action: "check_out", entity: "Attendance" });
  return { ok: true, message: "Absen pulang tercatat." };
}
