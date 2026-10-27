// Avatar gradien per orang (gaya Clay), huruf putih. Sama di light & dark.
// Dipakai avatar chat, anggota, akun.
const PALETTE = [
  "bg-gradient-to-br from-emerald-400 to-sky-500 text-white",
  "bg-gradient-to-br from-fuchsia-400 to-purple-500 text-white",
  "bg-gradient-to-br from-sky-400 to-indigo-500 text-white",
  "bg-gradient-to-br from-rose-400 to-pink-500 text-white",
  "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
  "bg-gradient-to-br from-teal-400 to-cyan-500 text-white",
  "bg-gradient-to-br from-violet-400 to-indigo-500 text-white",
  "bg-gradient-to-br from-lime-400 to-emerald-500 text-white",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
