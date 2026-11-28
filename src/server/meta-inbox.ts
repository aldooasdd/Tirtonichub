// Inbox WA + IG lewat Meta resmi. Webhook → parseMeta → simpanPesan; balas → kirimMeta.
// Env (server .env): META_APP_SECRET (cek tanda tangan webhook), META_VERIFY_TOKEN (verifikasi URL webhook),
// META_WA_TOKEN (token pengguna sistem, WhatsApp), META_IG_TOKEN (token Instagram, boleh sama dengan META_WA_TOKEN).
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";

export type MetaEvent = { channel: "WA" | "IG"; accountId: string; contactId: string; name?: string; dir: "in" | "out"; text: string; metaId: string; at: Date; riwayat?: boolean }; // riwayat = sinkron chat lama (coexistence), tidak menambah belum dibaca

const GRAPH = "https://graph.facebook.com/v23.0";

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, body mentah). */
export function sahMeta(body: string, sig: string | null, secret = process.env.META_APP_SECRET ?? ""): boolean {
  if (!secret || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from("sha256=" + createHmac("sha256", secret).update(body).digest("hex"));
  return a.length === b.length && timingSafeEqual(a, b);
}

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- payload webhook Meta

/** Teks yang ditampilkan untuk 1 pesan WA/IG; media belum diunduh, cukup label. */
function isi(m: Any): string {
  if (m.text?.body) return m.text.body;
  if (typeof m.text === "string" && m.text) return m.text;
  const t = m.type ?? m.attachments?.[0]?.type;
  const cap = m[t]?.caption;
  const label: Record<string, string> = { image: "Foto", video: "Video", audio: "Pesan suara", document: "Dokumen", sticker: "Stiker", location: "Lokasi", contacts: "Kontak", reaction: "Reaksi", share: "Postingan dibagikan", story_mention: "Mention di story", ig_reel: "Reel" };
  if (t === "reaction") return `Reaksi ${m.reaction?.emoji ?? ""}`.trim();
  if (t === "button") return m.button?.text ?? "Tombol";
  if (t === "interactive") return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "Balasan";
  return `[${label[t] ?? t ?? "Pesan"}]${cap ? ` ${cap}` : ""}`;
}

/** Timestamp Meta: detik / milidetik, angka atau teks. */
const waktu = (t: unknown) => {
  const n = Number(t);
  return !n ? new Date() : new Date(n < 1e12 ? n * 1000 : n);
};

/** Payload webhook Meta (WhatsApp + Instagram) → daftar pesan. Pesan dari HP admin (coexistence / echo) = dir "out". */
export function parseMeta(p: Any): MetaEvent[] {
  const out: MetaEvent[] = [];
  for (const e of p?.entry ?? []) {
    if (p.object === "whatsapp_business_account") {
      for (const c of e.changes ?? []) {
        const v = c.value ?? {};
        const acc = v.metadata?.phone_number_id;
        if (!acc) continue;
        const nama = new Map<string, string>((v.contacts ?? []).map((x: Any) => [x.wa_id, x.profile?.name]));
        for (const m of v.messages ?? []) out.push({ channel: "WA", accountId: acc, contactId: m.from, name: nama.get(m.from), dir: "in", text: isi(m), metaId: m.id, at: waktu(m.timestamp) });
        for (const m of v.message_echoes ?? []) out.push({ channel: "WA", accountId: acc, contactId: m.to, dir: "out", text: isi(m), metaId: m.id, at: waktu(m.timestamp) });
        // sinkron riwayat chat lama (field "history"): thread.id = nomor pelanggan
        for (const h of v.history ?? [])
          for (const th of h.threads ?? [])
            for (const m of th.messages ?? []) out.push({ channel: "WA", accountId: acc, contactId: th.id, dir: m.from === th.id ? "in" : "out", text: isi(m), metaId: m.id, at: waktu(m.timestamp), riwayat: true });
      }
    }
    if (p.object === "instagram") {
      // chat asli = entry.messaging; tombol "Uji" di dashboard Meta = entry.changes[].value
      const list = [...(e.messaging ?? []), ...(e.changes ?? []).filter((c: Any) => c.field === "messages").map((c: Any) => c.value)];
      for (const m of list) {
        if (!m.message?.mid) continue;
        const echo = !!m.message.is_echo;
        out.push({ channel: "IG", accountId: e.id, contactId: echo ? m.recipient?.id : m.sender?.id, dir: echo ? "out" : "in", text: isi(m.message), metaId: m.message.mid, at: waktu(m.timestamp) });
      }
    }
  }
  return out.filter((x) => x.contactId && x.metaId);
}

/** Nama kontak dari HP WA Business (field "smb_app_state_sync") → nama chat. */
export function kontakMeta(p: Any): { accountId: string; contactId: string; name: string }[] {
  const out: { accountId: string; contactId: string; name: string }[] = [];
  if (p?.object !== "whatsapp_business_account") return out;
  for (const e of p.entry ?? [])
    for (const c of e.changes ?? []) {
      const acc = c.value?.metadata?.phone_number_id;
      for (const s of c.value?.state_sync ?? []) {
        const k = s.contact;
        const name = k?.full_name || k?.first_name;
        if (acc && s.type === "contact" && s.action !== "remove" && k?.phone_number && name) out.push({ accountId: acc, contactId: String(k.phone_number).replace(/\D/g, ""), name });
      }
    }
  return out;
}

/** Simpan pesan; metaId sudah ada (dikirim dari web / webhook diulang) → dilewati. */
export async function simpanPesan(ev: MetaEvent[]): Promise<number> {
  let n = 0;
  for (const m of ev) {
    if (await prisma.inboxMessage.findUnique({ where: { metaId: m.metaId }, select: { id: true } })) continue;
    const key = { channel: m.channel, accountId: m.accountId, contactId: m.contactId };
    // thread baru dibuat "kosong" (lastAt 1970) lalu diperbarui di bawah, supaya pesan riwayat/terlambat tidak menimpa pesan terbaru
    const t = await prisma.inboxThread.upsert({
      where: { channel_accountId_contactId: key },
      create: { ...key, name: m.name ?? null, lastAt: new Date(0) },
      update: m.name ? { name: m.name } : {},
    });
    await prisma.inboxThread.update({
      where: { id: t.id },
      data: { ...(m.at > t.lastAt ? { lastText: m.text, lastAt: m.at } : {}), ...(m.riwayat ? {} : m.dir === "in" ? { unread: { increment: 1 } } : { unread: 0 }) },
    });
    await prisma.inboxMessage.create({ data: { threadId: t.id, dir: m.dir, text: m.text, metaId: m.metaId, at: m.at } }).catch(() => null); // dobel bersamaan → abaikan
    n++;
  }
  return n;
}

/** Kirim teks ke pelanggan. WA: maks 24 jam sejak pesan terakhir pelanggan (di luar itu Meta menolak). IG: sama, 24 jam. */
export async function kirimMeta(channel: string, accountId: string, to: string, text: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const wa = channel === "WA";
  // WA: token per nomor dari Sambungkan WhatsApp (tabel WaNumber), cadangan env META_WA_TOKEN
  const token = wa ? ((await prisma.waNumber.findUnique({ where: { phoneNumberId: accountId }, select: { token: true } }))?.token ?? process.env.META_WA_TOKEN) : process.env.META_IG_TOKEN || process.env.META_WA_TOKEN;
  if (!token) return { ok: false, error: `Token ${wa ? "META_WA_TOKEN" : "META_IG_TOKEN"} belum diisi di server.` };
  const body = wa ? { messaging_product: "whatsapp", to, type: "text", text: { body: text } } : { recipient: { id: to }, message: { text } };
  try {
    const r = await fetch(`${GRAPH}/${accountId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json().catch(() => ({}))) as Any;
    if (!r.ok) return { ok: false, error: j.error?.error_user_msg || j.error?.message || `HTTP ${r.status}` };
    const id = wa ? j.messages?.[0]?.id : j.message_id;
    return id ? { ok: true, id } : { ok: false, error: "Meta tidak mengembalikan id pesan." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengirim." };
  }
}
