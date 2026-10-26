import { NextRequest } from "next/server";
import { uploadAsset, StudioError } from "@/server/studio/store";
import { guarded, ok } from "@/server/studio/http";

// Unggah file hasil konten (multipart: itemId, file). Lihat uploadAsset untuk izin & batas ukuran.
export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const form = await req.formData().catch(() => null);
    const itemId = String(form?.get("itemId") ?? "");
    const file = form?.get("file");
    if (!itemId || !(file instanceof File)) throw new StudioError("invalid-argument", "Pilih file dan barangnya dulu.");
    return ok({ ok: true, ...(await uploadAsset(u, itemId, file)) });
  });
}
