// Notifikasi Studio juga dikirim ke WhatsApp (permintaan Zaki, 3 Nov 2026).
// Penerima = penerima push yang sama: tim Media (Zaki, Rayhan, Aulia, Salma) untuk semua notifikasi Studio,
// penerima Foto katalog (PUSH_KATALOG_EMAILS, bawaan ridho@tirtonichub.com) hanya untuk "Foto katalog ready".
// Jalur: GOWA (nomor yang sama dengan OTP) bila GOWA_URL diisi, selain itu webhook n8n. Matikan dengan STUDIO_WA=0.
import { prisma } from "@/server/db";
import { sendGowa, sendWa } from "@/server/wa";
import { katalogOnly, waText } from "./logic";

/** Kirim WA ke userIds. Tidak pernah melempar error. Mengembalikan jumlah nomor yang berhasil. */
export async function sendStudioWa(userIds: string[], msg: { type: string; title: string; body?: string; url: string }): Promise<number> {
  if (process.env.STUDIO_WA === "0" || !userIds.length) return 0;
  try {
    const users = await prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { waNumber: true, email: true } });
    const only = msg.type === "studio_katalog" ? [] : katalogOnly(); // Ridho dkk. hanya menerima WA Foto katalog
    const text = waText(msg);
    const send = process.env.GOWA_URL ? sendGowa : sendWa;
    let n = 0;
    for (const u of users) {
      if (!u.waNumber || only.includes(u.email.toLowerCase())) continue;
      if (await send(u.waNumber, text)) n++;
      else console.error("[studio-wa] gagal kirim", msg.type);
    }
    return n;
  } catch (e) {
    console.error("[studio-wa]", e);
    return 0;
  }
}
