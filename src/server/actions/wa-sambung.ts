"use server";

// Sambungkan nomor WA Business (aplikasi HP) ke Inbox lewat Embedded Signup coexistence.
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { META_APP_ID } from "@/lib/meta";

const G = "https://graph.facebook.com/v23.0";

async function graph(path: string, token: string, init?: { method: "POST"; body: object }) {
  const r = await fetch(`${G}/${path}`, {
    method: init?.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, ...(init ? { "content-type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- respons Graph API
  if (!r.ok) throw new Error(j.error?.error_user_msg || j.error?.message || `HTTP ${r.status}`);
  return j;
}

export async function sambungWa(i: { code: string; phoneNumberId: string; wabaId: string; label: string }): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireChannel();
  const label = i.label.trim() || "Admin";
  const secret = process.env.META_APP_SECRET;
  if (!secret) return { ok: false, message: "META_APP_SECRET belum diisi di server." };
  if (!/^\d+$/.test(i.phoneNumberId) || !/^\d+$/.test(i.wabaId)) return { ok: false, message: "Data nomor dari Meta tidak lengkap. Ulangi Sambungkan." };
  try {
    // kode sekali pakai → token pengguna sistem integrasi bisnis (tidak kedaluwarsa)
    const q = new URLSearchParams({ client_id: META_APP_ID, client_secret: secret, code: i.code });
    const r = await fetch(`${G}/oauth/access_token?${q}`, { signal: AbortSignal.timeout(20000) });
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    if (!j.access_token) return { ok: false, message: `Gagal menukar kode Meta: ${j.error?.message ?? r.status}` };
    const token = j.access_token;
    await graph(`${i.wabaId}/subscribed_apps`, token, { method: "POST", body: {} }); // webhook WA → app ini
    const info = await graph(`${i.phoneNumberId}?fields=display_phone_number,verified_name`, token).catch(() => ({}) as Record<string, string>);
    await prisma.waNumber.upsert({
      where: { phoneNumberId: i.phoneNumberId },
      create: { phoneNumberId: i.phoneNumberId, wabaId: i.wabaId, label, displayPhone: info.display_phone_number ?? null, token, createdBy: ctx.userId },
      update: { wabaId: i.wabaId, label, displayPhone: info.display_phone_number ?? null, token },
    });
    // minta sinkron kontak + riwayat chat dari HP (coexistence); gagal tidak menggagalkan sambungan
    const sync: string[] = [];
    for (const t of ["smb_app_state_sync", "history"]) {
      await graph(`${i.phoneNumberId}/smb_app_data`, token, { method: "POST", body: { messaging_product: "whatsapp", sync_type: t } }).catch((e) => sync.push(`${t}: ${e instanceof Error ? e.message : e}`));
    }
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action: "wa_sambung", entity: "WaNumber", entityId: i.phoneNumberId, after: { label, display: info.display_phone_number, sync } });
    revalidatePath("/channel/inbox", "layout");
    return { ok: true, message: `${label} (${info.display_phone_number ?? i.phoneNumberId}) tersambung.${sync.length ? ` Sinkron riwayat belum jalan: ${sync.join(" · ")}` : " Riwayat chat & kontak sedang disinkron."}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Gagal menyambungkan." };
  }
}

export async function ubahLabelWa(phoneNumberId: string, label: string): Promise<void> {
  await requireChannel();
  if (label.trim()) await prisma.waNumber.update({ where: { phoneNumberId }, data: { label: label.trim() } });
  revalidatePath("/channel/inbox", "layout");
}
