// Analisis IDCC (Studio) → n8n (OpenAI). Body dari UI ({mode:"nilai"|"ringkas", ...}).
// Webhook balikin JSON apa adanya: {items:[...]} utk "nilai", {ringkasan} utk "ringkas".

export type IdccResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

export async function analyzeIdccViaN8n(body: unknown): Promise<IdccResult> {
  const url = process.env.N8N_IDCC_WEBHOOK_URL;
  if (!url) return { ok: false, status: 503, error: "Layanan AI IDCC belum diatur di server (kunci API)." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.N8N_IDCC_SECRET || process.env.N8N_NOTA_OCR_SECRET || "",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: 502, error: "AI gagal (HTTP " + res.status + ")." };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 502, error: "AI tidak bisa dihubungi." };
  }
}
