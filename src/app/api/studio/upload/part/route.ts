import { NextRequest } from "next/server";
import { bigPart } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// Satu potongan (badan = byte mentah, maks 16 MB): ?id=…&n=1..10000
export async function PUT(req: NextRequest) {
  return guarded(async (u) => {
    const id = String(req.nextUrl.searchParams.get("id") ?? "");
    const n = Number(req.nextUrl.searchParams.get("n"));
    return ok(await bigPart(u, id, n, Buffer.from(await req.arrayBuffer())));
  });
}
