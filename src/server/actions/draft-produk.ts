"use server";

// Draft produk Tirtonichub: satu draft untuk semua toko. Orang produk isi data → QC isi SKU + RFID → tayang.
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma";
import { requireProduk } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import type { DraftData } from "@/lib/product-draft";

export async function simpanDraft(id: string | null, data: DraftData): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ctx = await requireProduk();
  const title = data.d.title.trim() || "(tanpa nama)";
  const json = data as unknown as Prisma.InputJsonValue;
  const r = id
    ? await prisma.draftProduk.update({ where: { id }, data: { title, data: json, updatedBy: ctx.userId } }).catch(() => null)
    : await prisma.draftProduk.create({ data: { title, data: json, createdBy: ctx.userId, updatedBy: ctx.userId } });
  if (!r) return { ok: false, message: "Draft tidak ditemukan (mungkin sudah ditayangkan atau dihapus)." };
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: id ? "draft_produk_edit" : "draft_produk_create", entity: "DraftProduk", entityId: r.id, after: { title } });
  revalidatePath("/channel/produk", "layout");
  return { ok: true, id: r.id };
}

export async function hapusDraft(id: string): Promise<void> {
  const ctx = await requireProduk();
  const r = await prisma.draftProduk.deleteMany({ where: { id } });
  if (!r.count) return;
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "draft_produk_hapus", entity: "DraftProduk", entityId: id });
  revalidatePath("/channel/produk", "layout");
}
