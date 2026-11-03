import { guarded, ok } from "@/server/studio/http";
import { StudioError } from "@/server/studio/store";
import { pushConfigured, sendPush } from "@/server/push/send";
import { sendStudioWa, studioSender } from "@/server/push/wa";
import { maskPhone } from "@/server/push/katalog-logic";

// Admin: kirim notifikasi uji ke semua perangkat miliknya sendiri + WA ke nomor akunnya (cek WA Tirtonichub/GOWA).
export async function POST() {
  return guarded(async (u) => {
    if (!u.full) throw new StudioError("permission-denied", "Hanya admin.");
    const msg = { type: "studio_uji", title: "Notifikasi uji", body: "Notifikasi Tirtonic Studio sudah aktif.", url: "/studio/" };
    const push = pushConfigured();
    const devices = push ? await sendPush([u.userId], msg, { record: false, wa: false }) : 0;
    const [wa, sender] = await Promise.all([sendStudioWa([u.userId], msg), studioSender()]);
    return ok({ ok: true, push, devices, wa: { ...wa, from: sender.number ? maskPhone(sender.number) : "", host: sender.host, senderError: sender.error ?? "" } });
  }, { allowUnattended: true });
}
