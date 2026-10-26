import { NextRequest } from "next/server";
import { bigAbort } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => ({}))) as { id?: string };
    await bigAbort(u, String(b.id ?? ""));
    return ok({ ok: true });
  });
}
