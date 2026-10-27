// Warna avatar/inisial dari nama (biar UI tak hitam-putih). Tint translucent
// jalan di light & dark. Dipakai avatar chat, anggota, akun.
const PALETTE = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-teal-500/15 text-teal-600 dark:text-teal-300",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
