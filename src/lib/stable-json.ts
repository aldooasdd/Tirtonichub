/** JSON dengan urutan kunci tetap. PostgreSQL (JSONB) menyusun ulang kunci objek, jadi perbandingan
 *  JSON.stringify biasa antara data di layar dan data tersimpan bisa selalu "berbeda" walau isinya sama. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x,
  );
}
