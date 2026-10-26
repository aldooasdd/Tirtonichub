import { NextRequest } from "next/server";
import { bigFinish } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => ({}))) as { id?: string };
    return ok({ ok: true, ...(await bigFinish(u, String(b.id ?? ""))) });
  });
}
