"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";

export type ActionResult = { ok: boolean; message?: string; id?: string };

export const PCAL_COLORS = ["lime", "orange", "purple", "teal", "green", "pink"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

type EventInput = { date: string; title: string; time?: string | null; color?: string | null; note?: string | null };

function validate(f: EventInput): string | null {
  if (!DATE_RE.test(f.date)) return "Tanggal tidak valid.";
  if (!f.title.trim()) return "Judul wajib diisi.";
  if (f.time && !TIME_RE.test(f.time)) return "Jam tidak valid (HH:MM).";
  if (f.color && !PCAL_COLORS.includes(f.color)) return "Warna tidak valid.";
  return null;
}

/** Tambah acara kalender pribadi (hanya milik sendiri). */
export async function addEvent(f: EventInput): Promise<ActionResult> {
  const ctx = await requireMedia();
  const err = validate(f);
  if (err) return { ok: false, message: err };
  const e = await prisma.personalCalEvent.create({
    data: {
      userId: ctx.userId,
      date: f.date,
      title: f.title.trim().slice(0, 120),
      time: f.time || null,
      color: f.color && PCAL_COLORS.includes(f.color) ? f.color : "lime",
      note: f.note?.trim().slice(0, 500) || null,
    },
  });
  return { ok: true, id: e.id };
}

/** Ubah acara pribadi milik sendiri. */
export async function updateEvent(id: string, f: EventInput): Promise<ActionResult> {
  const ctx = await requireMedia();
  const err = validate(f);
  if (err) return { ok: false, message: err };
  const own = await prisma.personalCalEvent.findUnique({ where: { id } });
  if (!own || own.userId !== ctx.userId) return { ok: false, message: "Tidak ditemukan." };
  await prisma.personalCalEvent.update({
    where: { id },
    data: {
      date: f.date,
      title: f.title.trim().slice(0, 120),
      time: f.time || null,
      color: f.color && PCAL_COLORS.includes(f.color) ? f.color : own.color,
      note: f.note?.trim().slice(0, 500) || null,
    },
  });
  return { ok: true };
}

/** Hapus acara pribadi milik sendiri. */
export async function deleteEvent(id: string): Promise<ActionResult> {
  const ctx = await requireMedia();
  const own = await prisma.personalCalEvent.findUnique({ where: { id } });
  if (!own || own.userId !== ctx.userId) return { ok: false, message: "Tidak ditemukan." };
  await prisma.personalCalEvent.delete({ where: { id } });
  return { ok: true };
}

/** Simpan warna default + catatan privat kalender sendiri. */
export async function savePcal(f: { color?: string; notes?: string }): Promise<ActionResult> {
  const ctx = await requireMedia();
  const color = f.color && PCAL_COLORS.includes(f.color) ? f.color : "lime";
  const notes = f.notes?.slice(0, 5000) || null;
  await prisma.mediaPcal.upsert({
    where: { userId: ctx.userId },
    update: { color, notes },
    create: { userId: ctx.userId, color, notes },
  });
  return { ok: true };
}
