import { NextResponse } from "next/server";
import { studioCtx } from "@/server/studio/session";
import { analyzeIdccViaN8n } from "@/server/n8n-idcc";

// Endpoint AI Analisis IDCC untuk Studio UI. Kontrak lama (Firebase): error via {error}.
const noStore = { "cache-control": "no-store" };
const err = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });

export async function POST(req: Request) {
  const c = await studioCtx();
  if (!c.ok) return err(401, "Silakan masuk dulu (izin).");
  if (!c.u.idcc) return err(403, "Akun belum diizinkan memakai Analisis IDCC (izin).");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Body tidak valid.");
  }

  const r = await analyzeIdccViaN8n(body);
  if (!r.ok) return err(r.status, r.error);
  return NextResponse.json(r.data, { headers: noStore });
}
