// AI belajar dari koreksi Finance: hasil OCR vs hasil final yang dikirim ke QC, per brand.
// Baris dibandingkan sebagai teks "name | qty | @Harga | total" (urutan baris diabaikan).

const r2 = (n: number) => Math.round(n * 100) / 100;

export const ocrRow = (name: string, qty: number, harga: number, total: number) =>
  `${name.trim()} | qty=${qty} | @Harga=${r2(harga)} | total=${r2(total)}`;

/** Gabung baris jadi satu teks; urut biar perbandingan tak tergantung urutan. */
export const ocrRows = (rows: string[]) => [...rows].sort().join("\n");

const MAX = 6000; // ponytail: batas kasar karakter prompt, naikkan bila contoh sering terpotong

/** Teks koreksi untuk prompt n8n. "" bila belum ada koreksi. */
export function learnedPrompt(samples: { aiRows: string; finalRows: string }[]): string {
  if (!samples.length) return "";
  const body = samples
    .map((s, i) => `Nota #${i + 1}\n--- AI baca (SALAH):\n${s.aiRows}\n--- Finance simpan (BENAR):\n${s.finalRows}`)
    .join("\n\n");
  return (
    "KOREKSI FINANCE dari nota sebelumnya brand ini. Pelajari polanya (penamaan, konversi qty, @Harga, total) dan terapkan ke nota sekarang. " +
    "JANGAN menyalin baris yang tidak ada di nota sekarang.\n\n" +
    body
  ).slice(0, MAX);
}
