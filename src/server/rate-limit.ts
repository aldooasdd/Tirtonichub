// ponytail: rate limit in-memory, cukup untuk 1 instance app. Jika multi-instance,
// pindah ke Redis/DB. Window geser sederhana per key.
const hits = new Map<string, number[]>();

/** true = diizinkan. Catat hit bila diizinkan. */
export function rateLimit(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
