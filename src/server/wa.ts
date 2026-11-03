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
export type GowaConf = { base?: string; auth?: string };
const gowaAuth = (auth?: string): Record<string, string> => (auth ? { authorization: `Basic ${Buffer.from(auth).toString("base64")}` } : {});

export async function sendGowa(phone: string, message: string, conf?: GowaConf): Promise<boolean> {
  const base = conf ? conf.base : process.env.GOWA_URL;
  const auth = conf ? conf.auth : process.env.GOWA_BASIC_AUTH;
  if (!base || !phone) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/send/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...gowaAuth(auth),
      },
      body: JSON.stringify({ phone: toJid(phone), message }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Nomor WA yang sedang tersambung di GOWA (GET /app/devices). null = tidak bisa dihubungi / belum login. */
export async function gowaSender(conf: GowaConf): Promise<{ ok: boolean; number: string; error?: string }> {
  if (!conf.base) return { ok: false, number: "", error: "alamat GOWA belum diisi" };
  try {
    const res = await fetch(`${conf.base.replace(/\/$/, "")}/app/devices`, { headers: gowaAuth(conf.auth), signal: AbortSignal.timeout(8000) });
    if (res.status === 401) return { ok: false, number: "", error: "kata sandi GOWA salah" };
    if (!res.ok) return { ok: false, number: "", error: "GOWA menjawab " + res.status };
    const j = (await res.json().catch(() => null)) as { results?: { device?: string }[] } | null;
    const dev = j?.results?.find((d) => d?.device)?.device ?? "";
    const number = dev.split(/[:@]/)[0].replace(/\D/g, "");
    return number ? { ok: true, number } : { ok: false, number: "", error: "WA belum login di GOWA (scan QR dulu)" };
  } catch {
    return { ok: false, number: "", error: "GOWA tidak bisa dihubungi" };
  }
}
