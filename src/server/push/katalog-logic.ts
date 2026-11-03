// Logika murni notifikasi WA "Foto katalog siap" (tanpa database, diuji di katalog-logic.test.ts).

/** Kartu yang masuk Ready dalam 10 menit digabung jadi satu pesan: kirim saat yang tertua sudah menunggu 10 menit. */
export const KATALOG_BATCH_MS = 10 * 60_000;
export function katalogBatchDue(pending: { movedAt: Date }[], now: Date): boolean {
  if (!pending.length) return false;
  const oldest = Math.min(...pending.map((p) => p.movedAt.getTime()));
  return now.getTime() - oldest >= KATALOG_BATCH_MS;
}

/** Link folder Google Drive yang sah (wajib untuk Foto katalog masuk Ready). */
export const isDriveFolderLink = (u: unknown): boolean => typeof u === "string" && u.length <= 500 && /^https:\/\/(drive|docs)\.google\.com\/\S+$/.test(u.trim());

/** Kirim sekali per kartu: bolak-balik Ready–Editing–Ready tidak mengirim ulang, kecuali link folder berubah. */
export function katalogShouldQueue(task: { ktlNotifAt?: unknown; ktlNotifUrl?: unknown }, driveUrl: string): boolean {
  if (!task.ktlNotifAt) return true;
  return String(task.ktlNotifUrl ?? "") !== driveUrl;
}

/** Status kartu Foto katalog berpindah dari tahap awal ke Ready (server langsung menjadikannya Tayang) atau langsung ke Tayang. */
const DONE = ["Ready", "Tayang"];
export const katalogEntersReady = (before: { status?: unknown } | null, after: { type?: unknown; status?: unknown }): boolean =>
  after.type === "ktl" && DONE.includes(String(after.status)) && !DONE.includes(String(before?.status ?? ""));

const GENDER: Record<string, string> = { men: "Men", women: "Women", unisex: "Unisex" };

const wibParts = (d: Date) => {
  const day = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(":", ".");
  return { day, time };
};

export type KatalogLine = { name: string; gender?: string | null; color?: string | null; driveUrl: string; movedBy: string; movedAt: Date };

/** Isi pesan WA: judul, per barang (nama, gender, warna, link folder), lalu siapa yang memindahkan dan hari/jam WIB. */
export function katalogWaText(lines: KatalogLine[], opts: { test?: boolean } = {}): string {
  const out = ["📸 Foto katalog siap" + (opts.test ? " (TES, contoh)" : ""), ""];
  lines.forEach((l, i) => {
    out.push(`${lines.length > 1 ? i + 1 + ". " : ""}*${l.name.trim()}*`);
    const meta = [l.gender && GENDER[l.gender] ? "Gender: " + GENDER[l.gender] : "", l.color ? "Warna: " + l.color.trim() : ""].filter(Boolean).join(" · ");
    if (meta) out.push(meta);
    out.push("Folder: " + l.driveUrl.trim());
    out.push("");
  });
  const by = [...new Set(lines.map((l) => l.movedBy.trim()).filter(Boolean))];
  out.push("Dipindahkan oleh: " + (by.length ? by.join(", ") : "-"));
  const ts = lines.map((l) => l.movedAt.getTime());
  const a = wibParts(new Date(Math.min(...ts))), b = wibParts(new Date(Math.max(...ts)));
  out.push("Waktu: " + (a.day === b.day ? `${a.day}, ${a.time === b.time ? a.time : a.time + "–" + b.time} WIB` : `${a.day} ${a.time} – ${b.day} ${b.time} WIB`));
  return out.join("\n");
}

/** Nomor untuk ditampilkan di layar admin: 0812****7890. */
export const maskPhone = (p: string) => {
  const d = String(p || "").replace(/\D/g, "").replace(/^62/, "0");
  return d.length < 8 ? d : d.slice(0, 4) + "****" + d.slice(-4);
};
