const fmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format tanggal+jam ke WIB (PRD §16). */
export function fmtWIB(d: Date | string): string {
  return fmt.format(typeof d === "string" ? new Date(d) : d);
}
