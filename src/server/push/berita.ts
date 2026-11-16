// Berita pagi: ringkasan terbaru dunia toko retail tenis di Indonesia → WA pemilik, sekali sehari 07.00–09.59 WIB.
// Nomor tujuan: BERITA_TENIS_WA (pisah koma). Kosong / ANTHROPIC_API_KEY kosong = mati.
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db";
import { sendGowa } from "@/server/wa";
import { inMorningWindow, wibKey } from "./logic";

const PROMPT = (day: string) => `Hari ini ${day} (WIB). Cari berita & info TERBARU (maks 7 hari terakhir) tentang bisnis toko retail tenis di Indonesia:
toko/brand tenis baru atau tutup, promo besar & harga, peluncuran raket/sepatu/senar, distributor & brand (Wilson, Babolat, Head, Yonex, dll) di Indonesia,
turnamen & tren pemain yang memengaruhi penjualan, marketplace (Shopee/Tokopedia/TikTok Shop) kategori tenis, padel bila relevan.
Tulis untuk pemilik toko Tirtonic (Jogja, Solo, Semarang) dalam Bahasa Indonesia, format WhatsApp:
judul "*Berita Tenis Pagi — ${day}*", lalu 5–8 poin singkat (*tebal* untuk inti), tiap poin 1–2 kalimat + sumber (nama situs + link),
tutup dengan 1–2 kalimat "Peluang untuk Tirtonic". Hanya fakta dari hasil pencarian; kalau sepi, tulis lebih sedikit poin. Jangan pakai markdown selain *tebal*.`;

/** Claude + web search. pause_turn → lanjutkan (maks 4x). */
export async function beritaTenis(day: string): Promise<string> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: PROMPT(day) }];
  for (let i = 0; i < 4; i++) {
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "ID", timezone: "Asia/Jakarta" } }],
      messages,
    });
    if (r.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: r.content });
      continue;
    }
    if (r.stop_reason === "refusal") throw new Error("ditolak model");
    return r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  }
  throw new Error("pencarian terlalu lama (pause_turn berulang)");
}

export async function runBerita(now = new Date()) {
  const to = (process.env.BERITA_TENIS_WA ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length || !process.env.ANTHROPIC_API_KEY || !inMorningWindow(now)) return;
  const day = wibKey(now);
  // Kunci dulu (unik) → sekali per hari. ponytail: gagal = tidak diulang hari itu (hemat biaya API).
  try {
    await prisma.pushLog.create({ data: { key: `berita:${day}` } });
  } catch {
    return;
  }
  await kirimBerita(day);
}

/** Kirim sekarang (juga dipakai tombol manual /api/berita-tenis). Return jumlah nomor yang terkirim. */
export async function kirimBerita(day = wibKey(new Date())): Promise<number> {
  const to = (process.env.BERITA_TENIS_WA ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) throw new Error("BERITA_TENIS_WA kosong di .env server");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY kosong di .env server");
  const text = (await beritaTenis(day)).slice(0, 4000);
  if (!text) throw new Error("Claude tidak menulis berita");
  let sent = 0;
  for (const n of to) if (await sendGowa(n, text)) sent++;
  if (!sent) throw new Error("GOWA gagal mengirim WA");
  return sent;
}
