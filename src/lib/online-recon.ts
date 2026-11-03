// Dompet online: kanal penjualan online yang saldonya dicatat Finance per bulan.
export const ONLINE_CHANNELS = ["SHOPEE", "TOKOPEDIA", "WEBSITE"] as const;
export type OnlineChannel = (typeof ONLINE_CHANNELS)[number];
export const CHANNEL_LABEL: Record<OnlineChannel, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Website" };
