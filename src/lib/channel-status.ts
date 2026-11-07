// Status order Shopee / TikTok Shop → label Indonesia.
const LABEL: Record<string, string> = {
  UNPAID: "Belum bayar",
  AWAITING_SHIPMENT: "Perlu dikirim",
  READY_TO_SHIP: "Perlu dikirim",
  PROCESSED: "Diproses",
  AWAITING_COLLECTION: "Menunggu kurir",
  RETRY_SHIP: "Kirim ulang",
  SHIPPED: "Dikirim",
  IN_TRANSIT: "Dikirim",
  TO_CONFIRM_RECEIVE: "Sampai",
  DELIVERED: "Sampai",
  COMPLETED: "Selesai",
  IN_CANCEL: "Proses batal",
  CANCELLED: "Batal",
  CANCEL: "Batal",
  TO_RETURN: "Retur",
  ON_HOLD: "Ditahan",
};

/** Tab Kelola Pesanan → status mentah Shopee/TikTok. */
export const ORDER_TABS = [
  { key: "semua", label: "Semua Pesanan", statuses: null },
  { key: "belum-bayar", label: "Belum Dibayar", statuses: ["UNPAID"] },
  { key: "perlu-kirim", label: "Perlu Dikirim", statuses: ["AWAITING_SHIPMENT", "READY_TO_SHIP", "RETRY_SHIP"] },
  { key: "menunggu-kurir", label: "Menunggu Kurir", statuses: ["PROCESSED", "AWAITING_COLLECTION"] },
  { key: "dikirim", label: "Dikirim", statuses: ["SHIPPED", "IN_TRANSIT", "TO_CONFIRM_RECEIVE", "DELIVERED"] },
  { key: "selesai", label: "Selesai", statuses: ["COMPLETED"] },
  { key: "batal", label: "Pembatalan", statuses: ["IN_CANCEL", "CANCELLED", "CANCEL"] },
  { key: "retur", label: "Pengembalian", statuses: ["TO_RETURN"] },
] as const;

export const statusLabel = (s: string) => LABEL[s] ?? s;
/** Warna status: perlu tindakan (amber), selesai (hijau), batal/retur (merah). */
export function statusTone(s: string): "warn" | "ok" | "bad" | "muted" {
  if (["AWAITING_SHIPMENT", "READY_TO_SHIP", "RETRY_SHIP"].includes(s)) return "warn";
  if (["COMPLETED", "DELIVERED", "TO_CONFIRM_RECEIVE"].includes(s)) return "ok";
  if (["CANCELLED", "CANCEL", "IN_CANCEL", "TO_RETURN"].includes(s)) return "bad";
  return "muted";
}
