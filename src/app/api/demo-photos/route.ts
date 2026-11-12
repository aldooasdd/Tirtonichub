import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { makeKey, putObject } from "@/server/storage";

// Foto kegiatan demo komunitas dari tirtonic.com (lintas-repo, header rahasia x-points-secret).
// File disimpan di storage PC; disajikan publik via /api/file?key= (kunci acak, aman dibagikan).
const authed = (req: NextRequest) => {
  const secret = process.env.POINTS_API_SECRET;
  return !!secret && req.headers.get("x-points-secret") === secret;
};
const urlOf = (req: NextRequest, key: string) => `${req.nextUrl.origin}/api/file?key=${encodeURIComponent(key)}`;

/** GET ?claimIds=a,b → { [claimId]: url[] } */
export async function GET(req: NextRequest) {
  if (!authed(req)) return new Response("Unauthorized", { status: 401 });
  const ids = (req.nextUrl.searchParams.get("claimIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  const rows = ids.length ? await prisma.demoPhoto.findMany({ where: { claimId: { in: ids } }, orderBy: { createdAt: "asc" } }) : [];
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.claimId] ??= []).push(urlOf(req, r.key));
  return Response.json(out);
}

/** POST multipart: claimId, file (jpeg), community?, title? */
export async function POST(req: NextRequest) {
  if (!authed(req)) return new Response("Unauthorized", { status: 401 });
  const form = await req.formData();
  const claimId = String(form.get("claimId") ?? "").slice(0, 64);
  const file = form.get("file");
  if (!claimId || !(file instanceof File)) return Response.json({ ok: false, message: "claimId/file wajib." }, { status: 400 });
  if (file.size > 3_000_000 || !/^image\//.test(file.type)) return Response.json({ ok: false, message: "Foto tidak valid / terlalu besar." }, { status: 400 });
  if ((await prisma.demoPhoto.count({ where: { claimId } })) >= 10) return Response.json({ ok: false, message: "Maksimal 10 foto." }, { status: 400 });

  const key = makeKey("demo-kegiatan", "jpg");
  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), "image/jpeg");
  } catch {
    return Response.json({ ok: false, message: "Penyimpanan PC tidak bisa dihubungi." }, { status: 503 });
  }
  await prisma.demoPhoto.create({
    data: { claimId, key, community: String(form.get("community") ?? "").slice(0, 120), title: String(form.get("title") ?? "").slice(0, 200) },
  });
  return Response.json({ ok: true, url: urlOf(req, key) });
}
