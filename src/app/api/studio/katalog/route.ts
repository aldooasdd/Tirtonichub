import { NextRequest } from "next/server";
import { guarded, ok } from "@/server/studio/http";
import { StudioError } from "@/server/studio/store";
import { katalogStatus, resendKatalog, setKatalogOn, setKatalogTo, testKatalog } from "@/server/push/katalog";

// WA "Foto katalog siap" (lihat src/server/push/katalog.ts).
// GET  = status untuk panel Tim & Aktivitas (admin penuh).
// POST {action:'toggle', on} / {action:'recipients', emails} / {action:'test'} = admin penuh; {action:'resend', taskId} = admin & Admin 2.
export async function GET() {
  return guarded(async (u) => {
    if (!u.full) throw new StudioError("permission-denied", "Hanya admin.");
    return ok({ ok: true, ...(await katalogStatus()) });
  }, { allowUnattended: true });
}

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    const b = (await req.json().catch(() => null)) as { action?: unknown; on?: unknown; taskId?: unknown } | null;
    const action = String(b?.action ?? "");
    if (action === "resend") {
      if (!u.staff) throw new StudioError("permission-denied", "Hanya admin.");
      if (typeof b?.taskId !== "string" || b.taskId.length > 64) throw new StudioError("invalid-argument", "Kartu tidak valid.");
      return ok({ ok: true, result: await resendKatalog(b.taskId, u.name) });
    }
    if (!u.full) throw new StudioError("permission-denied", "Hanya admin.");
    if (action === "toggle") {
      await setKatalogOn(b?.on === true);
      return ok({ ok: true, ...(await katalogStatus()) });
    }
    if (action === "recipients") {
      await setKatalogTo((b as { emails?: unknown } | null)?.emails);
      return ok({ ok: true, ...(await katalogStatus()) });
    }
    if (action === "test") return ok({ ok: true, result: await testKatalog(u.name) });
    throw new StudioError("invalid-argument", "Aksi tidak dikenal.");
  }, { allowUnattended: true });
}
