// Grup kartu produk mentah: sepatu sama model+warna yang di nota dipisah per
// ukuran digabung jadi satu kartu. Baris data (RawProduct) tetap per ukuran —
// hanya tampilan yang digabung.

/** Nama tanpa token ukuran, supaya kartu grup tak mengulang ukuran. */
export function stripSize(name: string, size: string | null): string {
  let n = name;
  const s = size?.trim();
  if (s) n = n.split(s).join(" ");
  // buang "EUR"/"US"/"UK" yatim, sisa "/", dan spasi dobel
  return n
    .replace(/\b(EUR|US|UK|CM)\b\s*$/i, "")
    .replace(/\s*[/·-]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Kunci grup: merek + warna + nama-dasar. Satu model-warna = satu kartu. */
export function groupKey(r: { brand: string; color: string; name: string }): string {
  return [r.brand, r.color, r.name].map((x) => x.trim().toLowerCase()).join("|");
}
