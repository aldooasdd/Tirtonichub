"use server";

import { requireAuth } from "@/server/auth/rbac";

export type ScanResult = { ok: boolean; message: string; resultCode?: string };

/** Ambil nomor HP dari isi barcode (URL riwayat tirtonic.com atau nomor mentah). */
function phoneFromScan(raw: string): string | null {
  const m = raw.match(/riwayat\/(\d{6,})/i);
  const digits = (m ? m[1] : raw).replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Scan selesai stringing → panggil endpoint tirtonic.com (set status selesai + WA customer). */
export async function finishStringingScan(scanned: string): Promise<ScanResult> {
  await requireAuth();
  const url = process.env.TIRTONIC_STRINGING_WEBHOOK;
  const token = process.env.TIRTONIC_STRINGING_TOKEN;
  if (!url || !token) return { ok: false, message: "Integrasi belum dikonfigurasi (env)." };

  const phone = phoneFromScan(scanned.trim());
  if (!phone) return { ok: false, message: "Barcode tak berisi nomor valid." };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, token }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { ok: false, message: "Gagal/timeout hubungi tirtonic.com." };
  }

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; resultCode?: string };
  if (data.ok) return { ok: true, message: `Selesai. Kode ${data.resultCode ?? ""} • WA terkirim.`, resultCode: data.resultCode };

  const reason: Record<string, string> = {
    not_started: "Belum dimulai di tirtonic.com (status harus 'dikerjakan').",
    no_active: "Tak ada stringing aktif untuk nomor ini.",
    already_done: "Sudah selesai sebelumnya.",
    wa_failed: "WA gagal terkirim — belum ditandai selesai. Coba lagi.",
    unauthorized: "Token salah.",
    bad_phone: "Nomor tak valid.",
    not_configured: "Server tirtonic.com belum set token.",
  };
  return { ok: false, message: reason[data.reason ?? ""] ?? "Gagal menyelesaikan." };
}
