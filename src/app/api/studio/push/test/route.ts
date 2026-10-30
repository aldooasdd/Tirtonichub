import { guarded, ok } from "@/server/studio/http";
import { StudioError } from "@/server/studio/store";
import { pushConfigured, sendPush } from "@/server/push/send";

// Admin: kirim notifikasi uji ke semua perangkat miliknya sendiri.
export async function POST() {
  return guarded(async (u) => {
    if (!u.full) throw new StudioError("permission-denied", "Hanya admin.");
    if (!pushConfigured()) throw new StudioError("failed-precondition", "Kunci notifikasi (VAPID) belum diisi di .env server.");
    const n = await sendPush([u.userId], { type: "studio_uji", title: "Notifikasi uji", body: "Notifikasi Tirtonic Studio sudah aktif di perangkat ini.", url: "/studio/" }, { record: false });
    return ok({ ok: true, devices: n });
  }, { allowUnattended: true });
}
