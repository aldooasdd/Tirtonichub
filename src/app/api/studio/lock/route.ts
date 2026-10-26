import { NextRequest } from "next/server";
import { acquire } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => ({}))) as { path?: string; holder?: string; ttlMs?: number };
    return ok({ ok: true, ...(await acquire(u, String(b.path ?? ""), String(b.holder ?? ""), Number(b.ttlMs) || 15000)) });
  });
}
