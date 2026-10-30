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

/** Nomor WA → JID gowa: 08xx/+62/62 → "62xxxx@s.whatsapp.net". */
export function toJid(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (!d.startsWith("62")) d = "62" + d;
  return `${d}@s.whatsapp.net`;
}

/** Kirim WA via GOWA (go-whatsapp-web-multidevice) di PC server. Terpisah dari n8n/tirtonic.com.
 *  Env GOWA_URL (base, mis. http://localhost:3000) + GOWA_BASIC_AUTH ("user:pass"). Belum diset → diam. */
export async function sendGowa(phone: string, message: string): Promise<boolean> {
  const base = process.env.GOWA_URL;
  if (!base || !phone) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/send/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.GOWA_BASIC_AUTH ? { authorization: `Basic ${Buffer.from(process.env.GOWA_BASIC_AUTH).toString("base64")}` } : {}),
      },
      body: JSON.stringify({ phone: toJid(phone), message }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
