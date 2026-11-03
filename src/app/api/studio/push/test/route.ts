import { guarded, ok } from "@/server/studio/http";
import { StudioError } from "@/server/studio/store";
import { pushConfigured, sendPush } from "@/server/push/send";
import { sendStudioWa } from "@/server/push/wa";

// Admin: kirim notifikasi uji ke semua perangkat miliknya sendiri + WA ke nomor akunnya (cek WA Tirtonichub/GOWA).
export async function POST() {
  return guarded(async (u) => {
    if (!u.full) throw new StudioError("permission-denied", "Hanya admin.");
    const msg = { type: "studio_uji", title: "Notifikasi uji", body: "Notifikasi Tirtonic Studio sudah aktif.", url: "/studio/" };
    const push = pushConfigured();
    const devices = push ? await sendPush([u.userId], msg, { record: false, wa: false }) : 0;
    const wa = await sendStudioWa([u.userId], msg);
    return ok({ ok: true, push, devices, wa });
  }, { allowUnattended: true });
}
