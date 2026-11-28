"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel, requireIg } from "@/server/auth/rbac";
import { makeKey, putObject } from "@/server/storage";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { igBalasKomentar, igSembunyikan, terbitkan } from "@/server/instagram";

/** Posting IG: 1 foto, 2–10 foto (carousel), atau 1 video (Reels). jadwal kosong = terbit sekarang. Foto harus JPG (syarat Instagram). */
export async function buatPostIg(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireIg();
  const caption = String(fd.get("caption") ?? "").trim();
  const jadwalRaw = String(fd.get("jadwal") ?? "").trim();
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: "Pilih foto atau video." };
  if (caption.length > 2200) return { ok: false, message: "Caption maksimal 2200 huruf." };
  const video = files.some((f) => f.type.startsWith("video/"));
  if (video && (files.length > 1 || files[0].type !== "video/mp4" || files[0].size > 30_000_000)) return { ok: false, message: "Reels: 1 video MP4, maks 30 MB." };
  if (!video && (files.length > 10 || files.some((f) => f.type !== "image/jpeg" || f.size > 8_000_000))) return { ok: false, message: "Foto harus JPG (maks 8 MB), maksimal 10 foto." };
  const jadwal = jadwalRaw ? new Date(`${jadwalRaw}:00+07:00`) : null; // input datetime-local = WIB
  if (jadwal && (Number.isNaN(jadwal.getTime()) || jadwal.getTime() < Date.now() + 60_000)) return { ok: false, message: "Jadwal harus minimal 1 menit dari sekarang." };

  const keys: string[] = [];
  for (const f of files) {
    const key = makeKey("ig", video ? "mp4" : "jpg");
    await putObject(key, Buffer.from(await f.arrayBuffer()), f.type);
    keys.push(key);
  }
  const p = await prisma.igPost.create({ data: { tipe: video ? "REELS" : keys.length > 1 ? "CAROUSEL" : "IMAGE", caption, keys, jadwal, createdBy: ctx.userId } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "ig_post", entity: "IgPost", entityId: p.id, after: { tipe: p.tipe, jadwal } });
  if (!jadwal) await terbitkan(p.id);
  const hasil = await prisma.igPost.findUnique({ where: { id: p.id } });
  revalidatePath("/channel/instagram");
  if (hasil?.status === "GAGAL") return { ok: false, message: `Gagal terbit: ${hasil.error}` };
  if (hasil?.status === "PROSES") return { ok: true, message: "Video sedang diproses Instagram, otomatis terbit dalam beberapa menit." };
  return { ok: true, message: jadwal ? "Posting dijadwalkan." : "Posting sudah terbit di Instagram." };
}

export async function aturPostIg(fd: FormData): Promise<void> {
  await requireIg();
  const id = String(fd.get("id"));
  if (fd.get("ulang")) {
    await prisma.igPost.updateMany({ where: { id, status: "GAGAL" }, data: { status: "TERJADWAL", jadwal: null, containerId: null, error: null } });
    await terbitkan(id);
  } else await prisma.igPost.deleteMany({ where: { id, status: { in: ["TERJADWAL", "GAGAL"] } } });
  revalidatePath("/channel/instagram");
}

/** Komentar IG (menu Komentar IG): balas publik / DM, sembunyikan / tampilkan. */
export async function aksiKomentar(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireChannel();
  const id = String(fd.get("id") ?? "");
  const text = String(fd.get("text") ?? "").trim();
  const aksi = String(fd.get("aksi") ?? "balas");
  try {
    if (aksi === "sembunyi" || aksi === "tampil") await igSembunyikan(id, aksi === "sembunyi");
    else {
      if (!text) return { ok: false, message: "Balasan kosong." };
      await igBalasKomentar(id, text.slice(0, 2200), aksi === "dm");
    }
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action: `ig_komentar_${aksi}`, entity: "IgComment", entityId: id, after: text ? { text } : {} });
    revalidatePath("/channel/instagram/komentar");
    return { ok: true, message: aksi === "dm" ? "DM terkirim." : aksi === "balas" ? "Balasan terkirim." : "Tersimpan." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Gagal." };
  }
}
