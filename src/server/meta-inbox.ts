// Inbox WA + IG lewat Meta resmi. Webhook → parseMeta → simpanPesan; balas → kirimMeta.
// Env (server .env): META_APP_SECRET (cek tanda tangan webhook), META_VERIFY_TOKEN (verifikasi URL webhook),
// META_WA_TOKEN (token pengguna sistem, WhatsApp), META_IG_TOKEN (token Instagram, boleh sama dengan META_WA_TOKEN).
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";

/** channel: WA | IG (DM) | IGK (komentar IG) | FB (Messenger Page). metaId komentar = "c:<comment id>". */
export type MetaEvent = { channel: "WA" | "IG" | "IGK" | "FB"; accountId: string; contactId: string; name?: string; dir: "in" | "out"; text: string; metaId: string; at: Date; riwayat?: boolean; mediaUrl?: string }; // riwayat = sinkron chat lama (coexistence), tidak menambah belum dibaca

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
    if (p.object === "instagram" || p.object === "page") {
      const ch = p.object === "page" ? "FB" : "IG";
      // chat asli = entry.messaging; tombol "Uji" di dashboard Meta = entry.changes[].value
      const list = [...(e.messaging ?? []), ...(e.changes ?? []).filter((c: Any) => c.field === "messages").map((c: Any) => c.value)];
      for (const m of list) {
        if (!m.message?.mid) continue;
        const echo = !!m.message.is_echo;
        const foto = (m.message.attachments ?? []).find((a: Any) => a.type === "image")?.payload?.url;
        out.push({ channel: ch, accountId: e.id, contactId: echo ? m.recipient?.id : m.sender?.id, dir: echo ? "out" : "in", text: isi(m.message), metaId: m.message.mid, at: waktu(m.timestamp), ...(foto ? { mediaUrl: foto } : {}) });
      }
      // komentar postingan IG (field "comments"); komentar akun sendiri = balasan kita
      for (const c of (e.changes ?? []).filter((x: Any) => x.field === "comments")) {
        const v = c.value ?? {};
        if (!v.id || !v.from?.id) continue;
        const kita = v.from.id === e.id;
        if (kita) continue; // balasan publik kita sudah dicatat saat dikirim
        out.push({ channel: "IGK", accountId: e.id, contactId: v.from.id, name: v.from.username ? `@${v.from.username}` : undefined, dir: "in", text: `[Komentar] ${v.text ?? ""}`.trim(), metaId: `c:${v.id}`, at: waktu(e.time) });
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

/** Simpan pesan; metaId sudah ada (dikirim dari web / webhook diulang) → dilewati. Hasil = pesan yang baru disimpan. */
export async function simpanPesan(ev: MetaEvent[]): Promise<MetaEvent[]> {
  const baru: MetaEvent[] = [];
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
    const ok = await prisma.inboxMessage.create({ data: { threadId: t.id, dir: m.dir, text: m.text, metaId: m.metaId, at: m.at, mediaUrl: m.mediaUrl ?? null } }).catch(() => null); // dobel bersamaan → abaikan
    if (ok) baru.push(m);
  }
  return baru;
}

type Kirim = { ok: true; id: string } | { ok: false; error: string };

async function post(path: string, token: string, body: object): Promise<{ ok: boolean; j: Any; status: number }> {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Any, status: r.status };
}
const gagal = (j: Any, status: number) => j.error?.error_user_msg || j.error?.message || `HTTP ${status}`;

/** Kirim ke pelanggan. WA: teks (24 jam). IG/FB: teks atau foto (24 jam). IGK: balas komentar publik, atau dm=true → DM (private reply, ≤7 hari). */
export async function kirimMeta(channel: string, accountId: string, to: string, text: string, o: { foto?: string; commentId?: string; dm?: boolean } = {}): Promise<Kirim> {
  try {
    if (channel === "WA") {
      const token = (await prisma.waNumber.findUnique({ where: { phoneNumberId: accountId }, select: { token: true } }))?.token ?? process.env.META_WA_TOKEN;
      if (!token) return { ok: false, error: "Token WhatsApp belum diisi di server." };
      const r = await post(`${accountId}/messages`, token, { messaging_product: "whatsapp", to, type: "text", text: { body: text } });
      return r.ok && r.j.messages?.[0]?.id ? { ok: true, id: r.j.messages[0].id } : { ok: false, error: gagal(r.j, r.status) };
    }
    const token = process.env.META_IG_TOKEN;
    if (!token) return { ok: false, error: "META_IG_TOKEN belum diisi di server." };
    if (channel === "IGK") {
      if (!o.commentId) return { ok: false, error: "Komentar yang dibalas tidak ditemukan." };
      if (o.foto) return { ok: false, error: "Balas komentar tidak bisa pakai foto. Centang Kirim lewat DM." };
      if (o.dm) {
        const r = await post(`${accountId}/messages`, token, { recipient: { comment_id: o.commentId }, message: { text } });
        return r.ok ? { ok: true, id: r.j.message_id ?? `dm-${Date.now()}` } : { ok: false, error: gagal(r.j, r.status) };
      }
      const r = await post(`${o.commentId}/replies`, token, { message: text });
      return r.ok && r.j.id ? { ok: true, id: `c:${r.j.id}` } : { ok: false, error: gagal(r.j, r.status) };
    }
    const message = o.foto ? { attachment: { type: "image", payload: { url: o.foto } } } : { text };
    const r = await post(`${accountId}/messages`, token, { recipient: { id: to }, ...(channel === "FB" ? { messaging_type: "RESPONSE" } : {}), message });
    return r.ok && r.j.message_id ? { ok: true, id: r.j.message_id } : { ok: false, error: gagal(r.j, r.status) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengirim." };
  }
}

/** Komentar baru yang cocok keyword Auto DM → kirim DM (private reply) sekali. */
export async function autoDmKomentar(ev: MetaEvent[]): Promise<void> {
  const kom = ev.filter((e) => e.channel === "IGK" && e.dir === "in");
  if (!kom.length) return;
  const aturan = await prisma.inboxAuto.findMany({ where: { aktif: true } });
  for (const k of kom) {
    const teks = k.text.toLowerCase();
    const a = aturan.find((x) => x.keyword.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean).some((w) => teks.includes(w)));
    if (!a) continue;
    const r = await kirimMeta("IGK", k.accountId, k.contactId, a.balasan, { commentId: k.metaId.slice(2), dm: true });
    const t = await prisma.inboxThread.findUnique({ where: { channel_accountId_contactId: { channel: "IGK", accountId: k.accountId, contactId: k.contactId } }, select: { id: true } });
    if (t) await prisma.inboxMessage.create({ data: { threadId: t.id, dir: "out", text: `[Auto DM] ${a.balasan}`, metaId: r.ok ? `auto:${r.id}` : null, error: r.ok ? null : r.error } });
  }
}

/** Nama + @username pengirim IG (Graph API, token Page META_IG_TOKEN). null = coba lagi nanti; "" = Meta menolak (tidak dicoba lagi). */
export async function namaIg(igsid: string, fb = false): Promise<string | null> {
  const token = process.env.META_IG_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`${GRAPH}/${igsid}?fields=${fb ? "name" : "name,username"}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return "";
    const j = (await r.json()) as { name?: string; username?: string };
    return j.name && j.username ? `${j.name} (@${j.username})` : j.username ? `@${j.username}` : (j.name ?? "");
  } catch {
    return null;
  }
}

/** Isi nama chat IG yang masih kosong (dipanggil setelah webhook & saat Inbox dibuka). */
export async function isiNamaIg(limit = 10): Promise<void> {
  const ts = await prisma.inboxThread.findMany({ where: { channel: { in: ["IG", "FB"] }, name: null }, select: { id: true, contactId: true, channel: true }, take: limit, orderBy: { lastAt: "desc" } });
  for (const t of ts) {
    const n = await namaIg(t.contactId, t.channel === "FB");
    if (n !== null) await prisma.inboxThread.update({ where: { id: t.id }, data: { name: n } });
  }
}
