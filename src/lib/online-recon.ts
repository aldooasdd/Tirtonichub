// Kanal penjualan online yang direkonsiliasi bulanan (metode bayar di nota → kanal).
export const ONLINE_CHANNELS = ["SHOPEE", "TOKOPEDIA", "WEBSITE"] as const;
export type OnlineChannel = (typeof ONLINE_CHANNELS)[number];
export const CHANNEL_LABEL: Record<OnlineChannel, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Website" };

/** Metode bayar nota → kanal online, null bila bukan online. */
export function channelOf(method: string): OnlineChannel | null {
  const m = (method || "").toLowerCase();
  if (m.includes("shopee")) return "SHOPEE";
  if (m.includes("tokopedia") || m.includes("tokped")) return "TOKOPEDIA";
  if (m.includes("website") || m.includes("web")) return "WEBSITE";
  return null;
}

/** "YYYY-MM" WIB → rentang UTC [from, to). */
export function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: new Date(`${y}-${pad(m)}-01T00:00:00+07:00`),
    to: new Date(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01T00:00:00+07:00`),
  };
}
