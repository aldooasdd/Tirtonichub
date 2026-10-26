import { NextRequest } from "next/server";
import { changes } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// Perubahan sejak `since` (ms). since=0 → semua data yang boleh dibaca.
export async function GET(req: NextRequest) {
  return guarded(async (u) => {
    const now = Date.now();
    const since = Number(req.nextUrl.searchParams.get("since")) || 0;
    const r = await changes(u, since);
    return ok({ ok: true, now, ...r });
  });
}
