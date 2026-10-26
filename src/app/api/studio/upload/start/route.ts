import { NextRequest } from "next/server";
import { bigStart } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// Mulai unggah bertahap: { itemId atau folderId, name, mime, size, section?, taskId? } → { id, partSize }
export async function POST(req: NextRequest) {
  return guarded(async (u) => ok({ ok: true, ...(await bigStart(u, (await req.json().catch(() => ({}))) as Record<string, string | undefined>)) }));
}
