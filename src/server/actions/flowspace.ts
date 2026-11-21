"use server";
// FlowSpace versi baru: tampilan tersimpan per pengguna (filter, urutan, kolom) di database (StudioDoc fsviews/{userId}).
// Hanya pemiliknya yang bisa membaca/mengubah; tidak ikut sinkron Studio (koleksi tidak dikenal rules.ts → tidak terbaca).
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { viewWhy, type FsView } from "@/lib/media/flowspace";

const MAX = 20;
export async function saveFsViews(views: FsView[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const a = await requireMedia();
  if (!Array.isArray(views) || views.length > MAX) return { ok: false, message: "Maksimal " + MAX + " tampilan." };
  for (const v of views) {
    const w = viewWhy(v);
    if (w) return { ok: false, message: w };
  }
  const path = "fsviews/" + a.userId;
  const data = { views } as unknown as Prisma.InputJsonValue;
  await prisma.studioDoc.upsert({ where: { path }, create: { path, coll: "fsviews", data }, update: { data } });
  return { ok: true };
}
