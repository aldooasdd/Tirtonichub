import { NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { readDevFile } from "@/server/storage";

// Dev only: sajikan file dari disk fallback. Butuh sesi (jangan publik).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return new Response("key wajib", { status: 400 });

  try {
    const buf = await readDevFile(key);
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=300" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
