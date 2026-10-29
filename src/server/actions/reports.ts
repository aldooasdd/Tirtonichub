"use server";

import { prisma } from "@/server/db";
import { requireAuth, requireReports } from "@/server/auth/rbac";
import { makeKey, putObject } from "@/server/storage";
import { notifyAdmins } from "@/server/notify";
import { sendWa } from "@/server/wa";

export type ActionResult = { ok: boolean; message?: string };

/** Nomor WA → format internasional wa.me (62, tanpa + / 0 depan). */
function waId(num: string): string {
  const d = num.replace(/\D/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}

type SubmitInput = {
  message: string;
  imageBase64?: string | null;
  mimeType?: string | null;
};

/** Semua role: kirim laporan error/pertanyaan + screenshot ke Admin. */
export async function submitReport(input: SubmitInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const message = input.message?.trim();
  if (!message) return { ok: false, message: "Keterangan wajib diisi." };

  let photoKey: string | null = null;
  if (input.imageBase64) {
    photoKey = makeKey("report", (input.mimeType ?? "").includes("png") ? "png" : "jpg");
    try {
      await putObject(photoKey, Buffer.from(input.imageBase64, "base64"), input.mimeType || "image/jpeg");
    } catch {
      return { ok: false, message: "Gagal simpan screenshot." };
    }
  }

  await prisma.report.create({ data: { message: message.slice(0, 2000), photoKey, createdById: ctx.userId } });
  await notifyAdmins({ type: "report", title: "Laporan baru masuk", body: message.slice(0, 120), link: "/admin/laporan" });

  // WA ke admin (tanpa foto, cuma keterangan masalahnya). Nomor dari env.
  const to = process.env.REPORT_WA_TO;
  if (to) {
    const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { fullName: true, waNumber: true } });
    const waLink = me?.waNumber ? `\n\nBalas pengirim: https://wa.me/${waId(me.waNumber)}` : "";
    await sendWa(to, `Laporan baru di Tirtonichub dari ${me?.fullName ?? "karyawan"}:\n\n${message}${waLink}`);
  }
  return { ok: true };
}

/** Admin: tandai laporan selesai. */
export async function resolveReport(id: string): Promise<ActionResult> {
  const ctx = await requireReports();
  if (!id) return { ok: false, message: "ID kosong." };
  const r = await prisma.report.findUnique({ where: { id }, select: { id: true, resolvedAt: true } });
  if (!r) return { ok: false, message: "Tidak ditemukan." };
  if (r.resolvedAt) return { ok: false, message: "Sudah selesai." };
  await prisma.report.update({ where: { id }, data: { resolvedAt: new Date(), resolvedById: ctx.userId } });
  return { ok: true };
}
