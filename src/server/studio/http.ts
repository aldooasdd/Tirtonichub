import { NextResponse } from "next/server";
import { studioCtx } from "./session";
import { StudioError } from "./store";
import type { StudioUser } from "./rules";

const noStore = { "cache-control": "no-store" };
export const ok = (body: unknown) => NextResponse.json(body, { headers: noStore });
export const fail = (status: number, code: string, message: string) => NextResponse.json({ ok: false, code, message }, { status, headers: noStore });

/** Jalankan handler bila login, terdaftar di Media, dan (bila wajib) sudah absen hari ini. */
export async function guarded(fn: (u: StudioUser) => Promise<Response>, opts: { allowUnattended?: boolean } = {}) {
  const c = await studioCtx();
  if (!c.ok) return fail(c.status, c.code, c.code === "login" ? "Silakan masuk dulu." : "Akun ini belum terdaftar di Media.");
  if (!opts.allowUnattended && c.attend.need && !c.attend.done) return fail(403, "absen", "Absen dulu sebelum memakai Media.");
  try {
    return await fn(c.u);
  } catch (e) {
    if (e instanceof StudioError) return fail(e.code === "not-found" ? 404 : e.code === "permission-denied" ? 403 : 400, e.code, e.message);
    console.error("[studio]", e);
    return fail(500, "internal", "Terjadi kesalahan di server. Coba lagi.");
  }
}
