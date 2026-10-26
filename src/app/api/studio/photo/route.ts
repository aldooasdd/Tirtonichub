import { NextRequest } from "next/server";
import { uploadCover, StudioError } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// Foto sampul barang (multipart: itemId, file). Maks 5 MB, JPG/PNG/WEBP, disimpan tanpa kompres ulang.
export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const form = await req.formData().catch(() => null);
    const itemId = String(form?.get("itemId") ?? "");
    const file = form?.get("file");
    if (!itemId || !(file instanceof File)) throw new StudioError("invalid-argument", "Pilih foto dan barangnya dulu.");
    return ok({ ok: true, ...(await uploadCover(u, itemId, file)) });
  });
}
