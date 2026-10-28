// Footer template yang ditempel PERSIS di bawah caption hasil AI.
// Teks tebal/miring = karakter unicode, jangan diubah (harus sama seperti di foto).

const VIDEO = `————————————
𝗦𝗵𝗼𝗽 𝗢𝗻𝗹𝗶𝗻𝗲 𝟮𝟰/𝟳:
Cicilan kartu kredit & Spaylater Via:
• Tokopedia | Shopee | Tiktok : 𝗧𝗜𝗥𝗧𝗢𝗡𝗜𝗖
𝗖𝗼𝗻𝘁𝗮𝗰𝘁 𝗨𝘀:
• CS WhatsApp 1: 0851 6321 5511
• CS WhatsApp 2: 0851 7984 8167
————————————
𝗧𝗿𝘂𝘀𝘁𝗲𝗱 𝗮𝗻𝗱 𝗕𝗲𝘀𝘁 𝗣𝗿𝗶𝗰𝗲
🔗 𝗧𝗮𝗽 𝗹𝗶𝗻𝗸 𝗼𝗻 𝗯𝗶𝗼 𝗳𝗼𝗿 𝗺𝗼𝗿𝗲.`;

const VISIT = `

Open daily: 09.00 - 21.00
Feel free to visit us:
📍𝗬𝗢𝗚𝗬𝗔𝗞𝗔𝗥𝗧𝗔, Palagan
📍𝗦𝗢𝗟𝗢, Manahan
📍𝗦𝗘𝗠𝗔𝗥𝗔𝗡𝗚, Simpang Lima`;

const SEPATU = `Bergaransi Tukar Ukuran, selama sesuai dengan ketentuan penukaran produk.

Silakan DM kami untuk mengetahui harga barang ini.

Team ahli kami memastikan keaslian semua produk yang dijual dan sudah melalui pengecekan kondisi fisik secara detail.

BNIB & 𝘼𝙐𝙏𝙃𝙀𝙉𝙏𝙄𝘾
${VIDEO}${VISIT}`;

const TAS = `Silakan DM kami untuk mengetahui harga barang ini.

Team ahli kami memastikan keaslian semua produk yang dijual dan sudah melalui pengecekan kondisi fisik secara detail.

BNWT & 𝘼𝙐𝙏𝙃𝙀𝙉𝙏𝙄𝘾
${VIDEO}${VISIT}`;

const RAKET = `𝘼𝙐𝙏𝙃𝙀𝙉𝙏𝙄𝘾
${VIDEO}${VISIT}`;

/** Pilih footer per jenis konten + kategori. null = tak ada template. */
export function captionTemplate(type: string, cat?: string | null): string | null {
  if (type === "vrv") return VIDEO; // video review: footer saja
  switch (cat) {
    case "sepatu": return SEPATU;
    case "tas": return TAS;
    case "raket": return RAKET;
    default: return null;
  }
}
