/** Harga jual = harga satuan × 135% × 115%, dibulatkan ke ATAS kelipatan 5000.
 *  Contoh hasil: 31000 → 35000, 36000 → 40000. */
export function computeSellPrice(unitPrice: number): number {
  const raw = Math.max(0, unitPrice) * 1.35 * 1.15;
  return Math.ceil(raw / 5000) * 5000;
}
