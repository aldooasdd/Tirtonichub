// Metode bayar di nota → rekening tujuan (tabel metode pembayaran Finance).
// ponytail: tabel di kode; pindah ke DB kalau Finance perlu ubah sendiri tanpa deploy.
export const AKUN_METODE: Record<string, string> = {
  "Debit BCA": "BCA - Tirtonic Global",
  "QRIS BCA": "BCA - Tirtonic Global",
  "Debit Selain BCA": "BCA - Tirtonic Global",
  "CC BCA": "BCA - Tirtonic Global",
  "Debit BRI": "BRI - Tirtonic Global",
  "QRIS BRI": "BRI - Tirtonic Global",
  "Debit Selain BRI": "BRI - Tirtonic Global",
  "CC BRI": "BRI - Tirtonic Global",
  "Debit Mandiri": "Bank Mandiri - Bisnis",
  "QRIS Mandiri": "Bank Mandiri - Bisnis",
  "Debit Selain Mandiri": "Bank Mandiri - Bisnis",
  "CC Mandiri": "Bank Mandiri - Bisnis",
  SHOPEE: "BCA - Tirtonic Global",
  TOKOPEDIA: "BCA - Tirtonic Global",
  WEBSITE: "BCA - Tirtonic Global",
  "Transfer BCA": "BCA - an Yupie Milenia",
  "Transfer BRI": "BRI - an Yupie Milenia",
  "Transfer Mandiri": "Mandiri - an Yupie Milenia",
};

export const TUNAI = "Tunai (kas cabang)";
export const TAK_TERPETAKAN = "Belum terpetakan";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const BY_NORM = new Map(Object.entries(AKUN_METODE).map(([m, a]) => [norm(m), a]));

/** Rekening tujuan untuk satu metode bayar di nota (huruf besar/kecil & spasi diabaikan). */
export function akunOf(method: string): string {
  const n = norm(method || "");
  if (/tunai|cash/.test(n)) return TUNAI;
  return BY_NORM.get(n) ?? TAK_TERPETAKAN;
}
