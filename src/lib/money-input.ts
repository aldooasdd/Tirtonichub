// Input uang: tampil bertitik ribuan (1.250.000) biar tak salah ketik nol. Desimal pakai koma (108.109,38).

const dots = (digits: string) => digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Rupiah bulat → teks input bertitik. 0/kosong → "". */
export const fmtInt = (n: number | string | null | undefined) => dots(String(n ?? "").replace(/\D/g, "")).replace(/^0$/, "");

/** Teks input bertitik → angka bulat. */
export const parseInt0 = (s: string) => Number(s.replace(/\D/g, "")) || 0;

/** Angka mentah ("108109.38" / 108109.38) → teks input "108.109,38". Titik di ujung ("12.") dipertahankan sbg koma. */
export function fmtDec(raw: number | string | null | undefined): string {
  const [i = "", f] = String(raw ?? "").split(".");
  const int = dots(i.replace(/\D/g, ""));
  return f === undefined ? int : `${int || "0"},${f.replace(/\D/g, "")}`;
}

/** Teks input "108.109,38" → angka mentah "108109.38" (string, aman untuk ketikan setengah jadi). */
export function parseDec(s: string): string {
  const [i, ...f] = s.replace(/\./g, "").split(",");
  const int = i.replace(/\D/g, "");
  return f.length ? `${int}.${f.join("").replace(/\D/g, "")}` : int;
}
