import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { SambungWa } from "@/components/channel/sambung-wa";
import { META_APP_ID, META_ES_CONFIG_ID } from "@/lib/meta";

/** Sambungkan nomor WA Business (tetap dipakai di HP) ke Inbox — coexistence. */
export default async function SambungWaPage() {
  await requireChannel();
  const nomor = await prisma.waNumber.findMany({ orderBy: { createdAt: "asc" }, select: { phoneNumberId: true, label: true, displayPhone: true } });
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/channel/inbox" className="text-14 text-muted-foreground">← Inbox</Link>
        <h1 className="text-24 font-semibold">Sambungkan WhatsApp</h1>
        <p className="text-14 text-muted-foreground">
          Nomor tetap dipakai di aplikasi WhatsApp Business di HP. Chat masuk & balasan dari HP ikut muncul di Inbox, dan admin bisa membalas dari sini. Siapkan HP nomor tersebut (WA Business versi terbaru), lalu klik Sambungkan dan ikuti petunjuk Meta (scan QR dari HP, setujui sinkron riwayat chat).
        </p>
      </div>
      <SambungWa appId={META_APP_ID} configId={META_ES_CONFIG_ID} nomor={nomor} />
    </div>
  );
}
