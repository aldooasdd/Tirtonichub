import { NextRequest } from "next/server";
import { newId, writeDoc, StudioError } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// { op: 'set'|'update'|'delete'|'add', path, data }. 'add' = path koleksi, id dibuat server.
export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const body = (await req.json().catch(() => null)) as { op?: string; path?: string; data?: Record<string, unknown> } | null;
    if (!body || typeof body.path !== "string") throw new StudioError("invalid-argument", "Permintaan tidak valid.");
    let { op, path } = body;
    const data = body.data && typeof body.data === "object" ? body.data : null;
    if (op === "add") {
      path = path.replace(/\/$/, "") + "/" + newId();
      op = "set";
    }
    if (op !== "set" && op !== "update" && op !== "delete") throw new StudioError("invalid-argument", "Operasi tidak dikenal.");
    if (JSON.stringify(data ?? {}).length > 1_500_000) throw new StudioError("invalid-argument", "Data terlalu besar.");
    const doc = await writeDoc(u, op, path, data);
    return ok({ ok: true, path, id: path.split("/").pop(), doc });
  });
}
