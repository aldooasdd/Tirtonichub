// Dipanggil sekali saat server Next.js menyala. Menjalankan tugas notifikasi push Studio tiap menit
// (jadwal syuting pagi 07.00 WIB, gabungan barang masuk). Matikan dengan PUSH_JOBS=0 di .env.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.PUSH_JOBS === "0") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // jangan jalan saat next build
  const g = globalThis as { __pushTimer?: ReturnType<typeof setInterval> };
  if (g.__pushTimer) return;
  const { pushTick } = await import("./server/push/jobs");
  setTimeout(() => void pushTick(), 15_000).unref(); // susulan cepat setelah restart
  g.__pushTimer = setInterval(() => void pushTick(), 60_000);
  g.__pushTimer.unref();
}
