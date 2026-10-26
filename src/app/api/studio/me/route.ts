import { studioCtx } from "@/server/studio/session";
import { getRaw } from "@/server/studio/store";
import { fail, ok } from "@/server/studio/http";

// Siapa yang login + dokumen anggota Media-nya + status absen hari ini.
export async function GET() {
  const c = await studioCtx();
  if (!c.ok) return fail(c.status, c.code, c.code === "login" ? "Silakan masuk dulu." : "Akun ini belum terdaftar di Media.");
  const member = await getRaw("members/" + c.u.email);
  return ok({ ok: true, now: Date.now(), member: { ...member, email: c.u.email }, attend: c.attend, absenUrl: "/absen" });
}
