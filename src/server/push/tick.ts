// Waktu pushTick terakhir berjalan di proses server ini (panel admin: tanda tugas terjadwal hidup).
const g = globalThis as { __pushTickAt?: number };
export const markTick = () => {
  g.__pushTickAt = Date.now();
};
export const lastTick = () => g.__pushTickAt ?? 0;
