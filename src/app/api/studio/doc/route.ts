import { NextRequest } from "next/server";
import { getDoc } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

export async function GET(req: NextRequest) {
  return guarded(async (u) => ok({ ok: true, doc: await getDoc(u, String(req.nextUrl.searchParams.get("path") ?? "")) }));
}
