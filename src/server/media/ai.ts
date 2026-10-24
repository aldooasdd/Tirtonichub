// AI media (Analisis IDCC + caption) lewat n8n — n8n yang memanggil OpenAI dengan
// credential yang sudah ada di n8n. App hanya mengirim payload + secret ke webhook.
// Env server: N8N_MEDIA_AI_WEBHOOK_URL, N8N_MEDIA_AI_WEBHOOK_SECRET (opsional).

const URL = process.env.N8N_MEDIA_AI_WEBHOOK_URL;
const SECRET = process.env.N8N_MEDIA_AI_WEBHOOK_SECRET;

async function callN8n<T>(payload: Record<string, unknown>): Promise<T> {
  if (!URL) throw new Error("N8N_MEDIA_AI_WEBHOOK_URL belum diatur di server.");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(URL, {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", ...(SECRET ? { "x-webhook-secret": SECRET } : {}) },
      body: JSON.stringify(payload),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string } & T;
    if (!r.ok) throw new Error(j.error || `AI gagal (${r.status})`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

export type NilaiBarang = { id: string; nama: string; kategori?: string; stok?: number; stok_lebih_90_hari?: number; stok_lebih_120_hari?: number; umur_rata_hari?: number; jumlah_varian?: number };
export type NilaiHasil = { id: string; rekomendasi: string; prioritas: number; alasan: string; ide_konten: string };

export async function aiNilai(barang: NilaiBarang[], tanggalLaporan?: string): Promise<NilaiHasil[]> {
  const b = barang.slice(0, 25);
  const j = await callN8n<{ items?: NilaiHasil[] }>({ mode: "nilai", barang: b, tanggal_laporan: tanggalLaporan || "" });
  const ids = new Set(b.map((x) => String(x.id)));
  return (j.items || []).filter((x) => ids.has(String(x.id)));
}

export async function aiRingkas(hasil: NilaiHasil[], tanggalLaporan?: string): Promise<string> {
  const j = await callN8n<{ ringkasan?: string }>({ mode: "ringkas", hasil: hasil.slice(0, 100), tanggal_laporan: tanggalLaporan || "" });
  return j.ringkasan || "";
}

export async function aiCaption(input: { nama: string; jenis_konten: string; kategori?: string; gender?: string; catatan?: string; deskripsi: string }): Promise<{ caption: string; hashtag: string[] }> {
  if ((input.deskripsi || "").trim().length < 20) throw new Error("Deskripsi barang terlalu pendek.");
  const j = await callN8n<{ caption?: string; hashtag?: string[] }>({ mode: "caption", ...input });
  return { caption: String(j.caption || "").slice(0, 1500), hashtag: Array.isArray(j.hashtag) ? j.hashtag.slice(0, 10).map(String) : [] };
}
