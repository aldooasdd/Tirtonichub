/** Kirim WA via webhook n8n (sama seperti tirtonic.com: {event:"pesan", phone, message}).
 *  Env N8N_WA_WEBHOOK_URL belum diset → diam (aksi utama tetap jalan). */
export async function sendWa(phone: string, message: string): Promise<boolean> {
  const url = process.env.N8N_WA_WEBHOOK_URL;
  if (!url || !phone) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "pesan", phone, message }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
