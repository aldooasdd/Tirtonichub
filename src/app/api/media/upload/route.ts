import { NextRequest, NextResponse } from "next/server";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { makeKey, putObject } from "@/server/storage";

// Unggah file hasil konten (foto/video final) ke satu barang media.
// ponytail: buffer seluruh file di memori (req.formData). Cukup untuk deliverable
// terkompres; kalau nanti perlu video mentah GB-an, ganti ke streaming multipart.
export async function POST(req: NextRequest) {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  if (!acc.canManage) return NextResponse.json({ ok: false, message: "Tidak berwenang." }, { status: 403 });

  const form = await req.formData();
  const itemId = String(form.get("itemId") ?? "");
  const file = form.get("file");
  if (!itemId || !(file instanceof File)) return NextResponse.json({ ok: false, message: "File/itemId wajib." }, { status: 400 });

  const item = await prisma.mediaItem.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) return NextResponse.json({ ok: false, message: "Barang tidak ditemukan." }, { status: 404 });

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.slice(0, 8) : "bin";
  const key = makeKey("hasil", ext);
  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
  } catch {
    return NextResponse.json({ ok: false, message: "Gagal simpan file." }, { status: 500 });
  }

  await prisma.mediaAsset.create({
    data: {
      itemId,
      name: file.name.slice(0, 200) || "file",
      key,
      mime: file.type || "application/octet-stream",
      size: file.size,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json({ ok: true });
}
