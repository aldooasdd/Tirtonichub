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

export const statusLabel = (s: string) => LABEL[s] ?? s;
/** Warna status: perlu tindakan (amber), selesai (hijau), batal/retur (merah). */
export function statusTone(s: string): "warn" | "ok" | "bad" | "muted" {
  if (["AWAITING_SHIPMENT", "READY_TO_SHIP", "RETRY_SHIP"].includes(s)) return "warn";
  if (["COMPLETED", "DELIVERED", "TO_CONFIRM_RECEIVE"].includes(s)) return "ok";
  if (["CANCELLED", "CANCEL", "IN_CANCEL", "TO_RETURN"].includes(s)) return "bad";
  return "muted";
}
