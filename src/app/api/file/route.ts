import { NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { getObject } from "@/server/storage";

// Sajikan objek (foto QC/nota/barang) dari S3/MinIO atau disk. Butuh sesi.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return new Response("key wajib", { status: 400 });

  try {
    const buf = await getObject(key);
    const ct = key.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": ct, "cache-control": "private, max-age=300" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
