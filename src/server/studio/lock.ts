// Kunci per kartu di dalam proses server: keputusan Creative Review / brief untuk kartu yang sama dijalankan
// bergiliran, sehingga dua keputusan bersamaan tidak bisa sama-sama tercatat (yang kedua melihat status terbaru
// dan ditolak). Tirtonichub berjalan sebagai satu proses Next.js di PC kantor (lihat docs/automation/architecture-decision.md).
const chains = new Map<string, Promise<unknown>>();

export async function withKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const tail = prev.then(() => mine);
  chains.set(key, tail);
  try {
    await prev.catch(() => {});
    return await fn();
  } finally {
    release();
    if (chains.get(key) === tail) chains.delete(key);
  }
}
