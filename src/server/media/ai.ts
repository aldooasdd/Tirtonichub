// AI media (Claude API): Analisis IDCC (nilai/ringkas) + caption Instagram.
// Port dari tirtonic-studio lib/idcc-ai.mjs. Kunci dari env server ANTHROPIC_API_KEY (jangan di chat).
const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";

const SYSTEM = `Anda analis konten untuk Tirtonic, toko perlengkapan tenis di Yogyakarta. Tim media (Tirtonic Studio) membuat konten IDCC: konten Instagram untuk membantu menjual stok lama (stok yang lama tidak laku).
Data berasal dari laporan "Umur Persediaan" finance. Setiap barang sudah dikelompokkan per model; varian adalah ukuran, grip, atau warna.
Kolom: stok total, stok_lebih_90_hari (umur 91-120 dan >120 hari), stok_lebih_120_hari, umur_rata_hari (perkiraan), jumlah_varian.
Pedoman rekomendasi:
- "video": barang yang paling mendesak dan menarik ditunjukkan bergerak/dipakai (sepatu dan raket populer, stok lama banyak, banyak ukuran tersedia). Slot video IDCC hanya sekitar 1 per minggu, jadi pilih dengan ketat.
- "foto": layak diangkat tetapi cukup dengan foto (tas, raket atau sepatu dengan stok lama sedang).
- "keduanya": hanya untuk barang dengan stok lama sangat banyak.
- "pantau": stok lama sedikit, varian tinggal sisa ukuran yang sulit, atau sudah ada di pipeline.
Prioritas 1 = kerjakan minggu ini, 2 = dua minggu ke depan, 3 = bisa menunggu.
Tulis alasan singkat (maks. 25 kata) berdasarkan angka, dan ide konten konkret (maks. 20 kata) dalam Bahasa Indonesia santai-profesional. Jangan mengarang harga atau diskon.`;

const SYSTEM_CAPTION = `Anda copywriter media sosial untuk Tirtonic, toko perlengkapan tenis di Yogyakarta.
Tulis isi caption Instagram berbahasa Indonesia yang santai, akrab, dan tetap informatif untuk satu postingan.
Struktur: satu kalimat pembuka yang menarik perhatian, lalu 2-4 baris keunggulan barang berdasarkan deskripsi (boleh diawali emoji yang relevan, secukupnya), lalu satu ajakan singkat.
Sesuaikan gaya dengan jenis konten: foto produk menonjolkan tampilan dan detail, video produk menonjolkan cara pakai/tampilan bergerak, video review mengajak menonton ulasan lengkap.
Jika gender ukuran diketahui (Men/Women/Unisex), sebutkan secara wajar.
Aturan penting: jangan mengarang spesifikasi, harga, diskon, stok, atau garansi yang tidak tertulis di deskripsi. Jangan menulis hashtag di dalam caption. Jangan menulis alamat, kontak, atau info toko karena sudah ada di template. Maksimal 900 karakter.
Berikan juga 5-8 hashtag spesifik barang (brand, seri, kategori, olahraga) tanpa tanda # dan tanpa spasi.`;

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };
const TOOL_NILAI: Tool = {
  name: "hasil_penilaian",
  description: "Kembalikan penilaian untuk SETIAP barang yang diberikan.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            rekomendasi: { type: "string", enum: ["video", "foto", "keduanya", "pantau"] },
            prioritas: { type: "integer", enum: [1, 2, 3] },
            alasan: { type: "string" },
            ide_konten: { type: "string" },
          },
          required: ["id", "rekomendasi", "prioritas", "alasan", "ide_konten"],
        },
      },
    },
    required: ["items"],
  },
};
const TOOL_RINGKAS: Tool = { name: "ringkasan", description: "Ringkasan untuk admin media.", input_schema: { type: "object", properties: { ringkasan: { type: "string" } }, required: ["ringkasan"] } };
const TOOL_CAPTION: Tool = {
  name: "caption_instagram",
  description: "Isi caption dan hashtag untuk satu postingan.",
  input_schema: { type: "object", properties: { caption: { type: "string" }, hashtag: { type: "array", items: { type: "string" } } }, required: ["caption", "hashtag"] },
};

async function askClaude(tool: Tool, userText: string, maxTokens: number, system = SYSTEM): Promise<Record<string, unknown>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY belum diatur di server.");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content: userText }] }),
    });
    const j = (await r.json().catch(() => ({}))) as { content?: { type: string; input?: Record<string, unknown> }[]; error?: { message?: string } };
    if (!r.ok) throw new Error("AI menolak (" + r.status + "): " + (j.error?.message || ""));
    const use = (j.content || []).find((c) => c.type === "tool_use");
    if (!use?.input) throw new Error("AI tidak mengembalikan hasil terstruktur.");
    return use.input;
  } finally {
    clearTimeout(timer);
  }
}

export type NilaiBarang = { id: string; nama: string; kategori?: string; stok?: number; stok_lebih_90_hari?: number; stok_lebih_120_hari?: number; umur_rata_hari?: number; jumlah_varian?: number };
export type NilaiHasil = { id: string; rekomendasi: string; prioritas: number; alasan: string; ide_konten: string };

export async function aiNilai(barang: NilaiBarang[], tanggalLaporan?: string): Promise<NilaiHasil[]> {
  const b = barang.slice(0, 25);
  const text = `Laporan umur persediaan per ${tanggalLaporan || "-"}.\nNilai ${b.length} barang berikut (JSON):\n${JSON.stringify(b)}`;
  const out = await askClaude(TOOL_NILAI, text, 6000);
  const ids = new Set(b.map((x) => String(x.id)));
  return ((out.items as NilaiHasil[]) || []).filter((x) => ids.has(String(x.id)));
}

export async function aiRingkas(hasil: NilaiHasil[], tanggalLaporan?: string): Promise<string> {
  const text = `Hasil penilaian barang IDCC dari laporan per ${tanggalLaporan || "-"} (JSON):\n${JSON.stringify(hasil.slice(0, 100))}\n\nTulis ringkasan 3-5 kalimat untuk admin media: berapa barang direkomendasikan per kategori, 3-5 barang paling mendesak dan alasannya, serta saran urutan pengerjaan minggu ini. Tanpa poin-poin, tanpa markdown.`;
  const out = await askClaude(TOOL_RINGKAS, text, 1200);
  return (out.ringkasan as string) || "";
}

export async function aiCaption(input: { nama: string; jenis_konten: string; kategori?: string; gender?: string; catatan?: string; deskripsi: string }): Promise<{ caption: string; hashtag: string[] }> {
  const clip = (v: string | undefined, n: number) => String(v || "").slice(0, n);
  const desc = clip(input.deskripsi, 4000);
  if (desc.trim().length < 20) throw new Error("Deskripsi barang terlalu pendek.");
  const text = `Nama barang: ${clip(input.nama, 200)}\nJenis konten: ${clip(input.jenis_konten, 60)}\nKategori: ${clip(input.kategori, 40)}\nGender ukuran: ${clip(input.gender, 20) || "-"}\nCatatan tim: ${clip(input.catatan, 500) || "-"}\n\nDeskripsi dari toko online:\n${desc}`;
  const out = await askClaude(TOOL_CAPTION, text, 1500, SYSTEM_CAPTION);
  return { caption: String(out.caption || "").slice(0, 1500), hashtag: Array.isArray(out.hashtag) ? (out.hashtag as unknown[]).slice(0, 10).map(String) : [] };
}
