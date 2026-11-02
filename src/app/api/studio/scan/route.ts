import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { StudioError } from "@/server/studio/store";
import { fail, guarded, ok } from "@/server/studio/http";

// Baca foto barang (formulir Barang masuk): nama, warna, kategori, gender ukuran diisi otomatis.
// Butuh ANTHROPIC_API_KEY di .env server. Hanya admin/Admin 2 (yang boleh mencatat barang).
const Result = z.object({
  name: z.string().describe("Merek + seri/model persis seperti tertulis di produk/label, mis. 'Adidas Adizero Ubersonic 4' atau 'Luxilon Alu Power 125 Rough Reel 220m'. Kosong bila tidak terbaca."),
  color: z.string().describe("Warna utama dalam Bahasa Indonesia huruf kecil, maks 3 warna dipisah '/', mis. 'putih/hitam'. Kosong bila tidak jelas."),
  category: z.enum(["sepatu", "raket", "tas", "baju", "celana", "aksesoris", "lainnya"]).describe("Senar, grip, overgrip, bola, kaus kaki, topi, wristband = aksesoris."),
  gender: z.enum(["men", "women", "unisex", ""]).describe("Hanya untuk sepatu/baju/celana: dari label (Men/Women/M/W/Wmns) atau bentuk produk. Kosong bila tidak yakin atau kategori lain."),
});

const MAX_B64 = 3_000_000;
type Media = "image/jpeg" | "image/png" | "image/webp";

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    if (!u.staff) throw new StudioError("permission-denied", "Hanya admin yang bisa memakai baca foto.");
    if (!process.env.ANTHROPIC_API_KEY) return fail(503, "ai-off", "Baca foto otomatis belum disiapkan di server.");
    const body = (await req.json().catch(() => null)) as { image?: unknown; hint?: unknown } | null;
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body?.image ?? ""));
    if (!m || m[2].length > MAX_B64) throw new StudioError("invalid-argument", "Foto tidak valid atau terlalu besar.");
    const hint = String(body?.hint ?? "").slice(0, 200);

    const client = new Anthropic();
    let res;
    try {
      res = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "low", format: betaZodOutputFormat(Result) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system:
          "Kamu membantu toko tenis Tirtonic Tennis Store mencatat barang baru dari foto. Baca teks pada produk, kotak, tag, atau label dengan teliti dan isi data barang. Jangan menebak merek atau seri yang tidak terlihat; kosongkan saja.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: m[1] as Media, data: m[2] } },
              { type: "text", text: "Isi data barang dari foto ini." + (hint ? " Nama dari nota (bisa salah ketik, perbaiki bila foto lebih jelas): " + hint : "") },
            ],
          },
        ],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return fail(502, "unavailable", "Layanan baca foto sedang sibuk. Coba lagi sebentar.");
      if (e instanceof Anthropic.AuthenticationError) return fail(503, "ai-off", "Kunci baca foto di server tidak valid.");
      if (e instanceof Anthropic.APIError) {
        console.error("[studio scan]", e.status, e.message);
        return fail(502, "unavailable", "Gagal membaca foto. Isi manual atau coba lagi.");
      }
      throw e;
    }
    if (res.stop_reason === "refusal" || !res.parsed_output) return fail(502, "unavailable", "Foto tidak bisa dibaca. Isi manual.");
    return ok({ ok: true, ...res.parsed_output });
  });
}
