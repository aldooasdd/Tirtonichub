// Inbox WA lewat GOWA (go-whatsapp-web-multidevice) di PC server: 1 instance GOWA = 1 nomor admin (perangkat tertaut, HP tetap jalan).
// Env: GOWA_INBOX="Admin 1|http://host.docker.internal:3001|user:pass,Admin 2|http://host.docker.internal:3002|user:pass"
//      GOWA_WEBHOOK_SECRET = sama dengan WHATSAPP_WEBHOOK_SECRET di GOWA (tanda tangan X-Hub-Signature-256).
// Webhook GOWA instance ke-n → /api/gowa/webhook?akun=n  (accountId thread = "gowa:n").
// ponytail: GOWA tidak resmi (risiko blokir WhatsApp); jalur resmi Meta tetap ada di meta-inbox.ts.
import type { MetaEvent } from "@/server/meta-inbox";

export type GowaAkun = { n: string; label: string; base: string; auth?: string };

export function gowaAkun(env = process.env.GOWA_INBOX ?? ""): GowaAkun[] {
  return env.split(",").map((x) => x.trim()).filter(Boolean).map((x, i) => {
    const [label, base, auth] = x.split("|").map((s) => s.trim());
    return { n: String(i + 1), label: label || `WA ${i + 1}`, base: base ?? "", auth: auth || undefined };
  }).filter((a) => a.base);
}

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- payload webhook GOWA (beda antar versi)

const MEDIA = ["image", "video", "audio", "document", "sticker", "location", "contact"] as const;
const LABEL: Record<string, string> = { image: "Foto", video: "Video", audio: "Pesan suara", document: "Dokumen", sticker: "Stiker", location: "Lokasi", contact: "Kontak" };

/** Payload webhook GOWA (format lama: {message:{text,id},from,...}; v7: {event,payload:{id,body,from_me,...}}) → pesan Inbox. Grup & status diabaikan. */
export function parseGowa(p: Any, akun: string): MetaEvent | null {
  if (p?.event && p.event !== "message") return null; // receipt, presence, dst
  const x: Any = p?.payload ?? p;
  const chat = String(x.chat_id ?? x.from ?? "");
  if (!chat || /@g\.us|@broadcast|@newsletter|status/.test(chat)) return null;
  const id = x.message?.id ?? x.id;
  if (!id) return null;
  const fromMe = !!(x.from_me ?? x.is_from_me ?? x.message?.is_from_me ?? x.info?.IsFromMe);
  const media = MEDIA.find((k) => x[k]);
  const cap = media && typeof x[media] === "object" ? x[media].caption : undefined;
  const text = x.message?.text || x.body || (typeof x.text === "string" ? x.text : "") || (media ? `[${LABEL[media]}]${cap ? ` ${cap}` : ""}` : "");
  if (!text) return null;
  const t = Date.parse(x.timestamp ?? "");
  return {
    channel: "WA",
    accountId: `gowa:${akun}`,
    contactId: chat.split("@")[0].split(":")[0].replace(/\D/g, ""),
    name: fromMe ? undefined : (x.pushname ?? x.from_name ?? undefined) || undefined,
    dir: fromMe ? "out" : "in",
    text,
    metaId: `gowa:${id}`,
    at: Number.isNaN(t) ? new Date() : new Date(t),
  };
}

/** Kirim teks lewat GOWA instance nomor itu. id dikembalikan supaya echo webhook (from_me) tidak dobel. */
export async function kirimGowa(akun: string, to: string, text: string, foto?: { buf: Buffer; name: string; type: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const a = gowaAkun().find((x) => x.n === akun);
  if (!a) return { ok: false, error: `GOWA akun ${akun} belum diatur di GOWA_INBOX.` };
  const auth: Record<string, string> = a.auth ? { authorization: `Basic ${Buffer.from(a.auth).toString("base64")}` } : {};
  const phone = `${to}@s.whatsapp.net`;
  try {
    let body: BodyInit;
    if (foto) {
      const fd = new FormData();
      fd.append("phone", phone);
      fd.append("caption", text);
      fd.append("image", new Blob([new Uint8Array(foto.buf)], { type: foto.type }), foto.name);
      body = fd;
    } else body = JSON.stringify({ phone, message: text });
    const r = await fetch(`${a.base.replace(/\/$/, "")}/send/${foto ? "image" : "message"}`, {
      method: "POST",
      headers: foto ? auth : { "content-type": "application/json", ...auth },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const j = (await r.json().catch(() => ({}))) as Any;
    if (!r.ok) return { ok: false, error: j.message || `GOWA ${r.status}` };
    const id = j.results?.message_id ?? j.results?.id;
    return { ok: true, id: id ? `gowa:${id}` : `gowa:sent-${Date.now()}` };
  } catch {
    return { ok: false, error: "GOWA tidak bisa dihubungi." };
  }
}
