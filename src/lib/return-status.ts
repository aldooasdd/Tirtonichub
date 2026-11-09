/** Status retur Shopee → label & warna. */
export const RETURN_STATUS: Record<string, { label: string; tone: string }> = {
  REQUESTED: { label: "Diajukan", tone: "text-amber-600" },
  ACCEPTED: { label: "Disetujui", tone: "text-emerald-600" },
  CANCELLED: { label: "Dibatalkan", tone: "text-muted-foreground" },
  JUDGING: { label: "Ditinjau Shopee", tone: "text-amber-600" },
  CLOSED: { label: "Selesai", tone: "text-muted-foreground" },
  PROCESSING: { label: "Diproses", tone: "text-sky-600" },
  SELLER_DISPUTE: { label: "Disanggah penjual", tone: "text-destructive" },
};
