// Notifikasi Studio juga dikirim ke WhatsApp (permintaan Zaki, 3 Nov 2026).
// Nomor: MediaMember.phone (No. WhatsApp di Tim & Aktivitas), bila kosong User.waNumber.
// Penerima = penerima push yang sama: tim Media (Zaki, Rayhan, Aulia, Salma) untuk semua notifikasi Studio,
// penerima Foto katalog (PUSH_KATALOG_EMAILS, bawaan ridho@tirtonichub.com) hanya untuk "Foto katalog ready".
// Pengirim: webhook n8n (N8N_WA_WEBHOOK_URL) = nomor Tirtonic Costumer Care — kembali ke jalur awal (permintaan Zaki 3 Nov 2026).
// STUDIO_WA_VIA=gowa memakai GOWA (STUDIO_GOWA_URL, kosong = GOWA_URL milik OTP). Tidak ada pindah jalur otomatis. STUDIO_WA=0 mematikan WA.
import { prisma } from "@/server/db";
import { gowaSender, sendGowa, sendWa, type GowaConf } from "@/server/wa";
import { katalogOnly, waText } from "./logic";

export type WaVia = "n8n" | "gowa" | "";
export function waVia(): WaVia {
  if (process.env.STUDIO_WA_VIA === "gowa") return studioGowa().base ? "gowa" : "";
  return process.env.N8N_WA_WEBHOOK_URL ? "n8n" : "";
}

/** GOWA untuk notifikasi Studio: STUDIO_GOWA_URL (mis. https://gowa.tirtonichub.com) + STUDIO_GOWA_BASIC_AUTH,
 *  bila kosong memakai GOWA_URL/GOWA_BASIC_AUTH yang sama dengan OTP. */
export function studioGowa(): GowaConf {
  if (process.env.STUDIO_GOWA_URL) return { base: process.env.STUDIO_GOWA_URL, auth: process.env.STUDIO_GOWA_BASIC_AUTH || "" };
  return { base: process.env.GOWA_URL, auth: process.env.GOWA_BASIC_AUTH };
}

/** Untuk panel admin: alamat GOWA (tanpa kata sandi) + nomor pengirim yang tersambung. */
export async function studioSender(): Promise<{ via: WaVia; host: string; number: string; ok: boolean; error?: string }> {
  const via = waVia();
  if (via !== "gowa") return { via, host: "", number: "", ok: via === "n8n" };
  const conf = studioGowa();
  let host = "";
  try { host = new URL(conf.base!).host; } catch { host = conf.base ?? ""; }
  return { via, host, ...(await gowaSender(conf)) };
}

/** Kirim satu pesan lewat jalur Studio (dipakai juga oleh katalog.ts). */
export const studioWaSend = (phone: string, text: string) => (waVia() === "n8n" ? sendWa(phone, text) : sendGowa(phone, text, studioGowa()));

export type WaResult = { via: WaVia; off: boolean; sent: number; failed: number; noNumber: number };

/** Kirim WA ke userIds. Tidak pernah melempar error. */
export async function sendStudioWa(userIds: string[], msg: { type: string; title: string; body?: string; url: string; wa?: string }): Promise<WaResult> {
  const r: WaResult = { via: waVia(), off: process.env.STUDIO_WA === "0", sent: 0, failed: 0, noNumber: 0 };
  if (r.off || !r.via || !userIds.length) return r;
  try {
    const users = await prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { waNumber: true, email: true, mediaMember: { select: { phone: true } } } });
    const only = msg.type === "studio_katalog" ? [] : katalogOnly(); // Ridho dkk. hanya menerima WA Foto katalog
    const text = msg.wa || waText(msg);
    for (const u of users) {
      if (only.includes(u.email.toLowerCase())) continue;
      const phone = u.mediaMember?.phone?.trim() || u.waNumber; // No. WhatsApp di Tim & Aktivitas dulu, lalu nomor akun Tirtonichub
      if (!phone) { r.noNumber++; continue; }
      if (await studioWaSend(phone, text)) r.sent++;
      else { r.failed++; console.error("[studio-wa] gagal kirim lewat", r.via, msg.type); }
    }
  } catch (e) {
    console.error("[studio-wa]", e);
  }
  return r;
}
