"use server";

import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { aiNilai, aiRingkas, type NilaiBarang } from "@/server/media/ai";
import { todayWIB } from "@/server/media/schedule-runner";

export type ActionResult = { ok: boolean; message?: string };

const ageDays = (arrived: Date, today: string) => Math.round((Date.parse(today) - arrived.getTime()) / 864e5);

/** Analisis IDCC: ambil kandidat stok lama → AI nilai + ringkas → simpan laporan. */
export async function runIdccAnalysis(): Promise<ActionResult> {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.idcc) return { ok: false, message: "Akun ini belum diberi izin Analisis IDCC." };

  const settings = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  const minQty = settings?.idccQty ?? 10;
  const minDays = settings?.idccDays ?? 90;
  const today = todayWIB();
  const items = await prisma.mediaItem.findMany();
  const kandidat = items
    .map((i) => ({ i, age: ageDays(i.arrived, today) }))
    .filter((x) => x.i.qty >= minQty && x.age >= minDays)
    .sort((a, b) => b.i.qty - a.i.qty)
    .slice(0, 25);
  if (!kandidat.length) return { ok: false, message: `Tidak ada stok lama (stok ≥ ${minQty} & umur ≥ ${minDays} hari).` };

  const barang: NilaiBarang[] = kandidat.map(({ i, age }) => ({
    id: i.id,
    nama: i.name + (i.color ? " " + i.color : ""),
    kategori: i.cat ?? undefined,
    stok: i.qty,
    stok_lebih_90_hari: age > 90 ? i.qty : 0,
    stok_lebih_120_hari: age > 120 ? i.qty : 0,
    umur_rata_hari: age,
    jumlah_varian: 1,
  }));

  try {
    const hasil = await aiNilai(barang, today);
    const ringkasan = hasil.length ? await aiRingkas(hasil, today) : "";
    await prisma.mediaIdccReport.create({
      data: { reportDate: new Date(today + "T00:00:00.000Z"), data: { barang, hasil }, summary: ringkasan, createdById: ctx.userId },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Gagal menjalankan AI." };
  }
}
