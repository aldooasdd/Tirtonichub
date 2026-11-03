// Notifikasi Studio juga dikirim ke WhatsApp (permintaan Zaki, 3 Nov 2026).
// Nomor: MediaMember.phone (No. WhatsApp di Tim & Aktivitas), bila kosong User.waNumber.
// Penerima = penerima push yang sama: tim Media (Zaki, Rayhan, Aulia, Salma) untuk semua notifikasi Studio,
// penerima Foto katalog (PUSH_KATALOG_EMAILS, bawaan ridho@tirtonichub.com) hanya untuk "Foto katalog ready".
// Jalur utama: webhook n8n (N8N_WA_WEBHOOK_URL, sama dengan pesan Laporan karyawan). STUDIO_WA_VIA=gowa memakai GOWA.
// Bila jalur pilihan belum diisi di .env, jalur lain dipakai. STUDIO_WA=0 mematikan WA.
import { prisma } from "@/server/db";
import { sendGowa, sendWa } from "@/server/wa";
import { katalogOnly, waText } from "./logic";

export type WaVia = "n8n" | "gowa" | "";
export function waVia(): WaVia {
  const n8n = !!process.env.N8N_WA_WEBHOOK_URL, gowa = !!process.env.GOWA_URL;
  if (process.env.STUDIO_WA_VIA === "gowa") return gowa ? "gowa" : n8n ? "n8n" : "";
  return n8n ? "n8n" : gowa ? "gowa" : "";
}

export type WaResult = { via: WaVia; off: boolean; sent: number; failed: number; noNumber: number };

/** Kirim WA ke userIds. Tidak pernah melempar error. */
export async function sendStudioWa(userIds: string[], msg: { type: string; title: string; body?: string; url: string }): Promise<WaResult> {
  const r: WaResult = { via: waVia(), off: process.env.STUDIO_WA === "0", sent: 0, failed: 0, noNumber: 0 };
  if (r.off || !r.via || !userIds.length) return r;
  try {
    const users = await prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { waNumber: true, email: true, mediaMember: { select: { phone: true } } } });
    const only = msg.type === "studio_katalog" ? [] : katalogOnly(); // Ridho dkk. hanya menerima WA Foto katalog
    const text = waText(msg);
    const send = r.via === "gowa" ? sendGowa : sendWa;
    for (const u of users) {
      if (only.includes(u.email.toLowerCase())) continue;
      const phone = u.mediaMember?.phone?.trim() || u.waNumber; // No. WhatsApp di Tim & Aktivitas dulu, lalu nomor akun Tirtonichub
      if (!phone) { r.noNumber++; continue; }
      if (await send(phone, text)) r.sent++;
      else { r.failed++; console.error("[studio-wa] gagal kirim lewat", r.via, msg.type); }
    }
  } catch (e) {
    console.error("[studio-wa]", e);
  }
  return r;
}
