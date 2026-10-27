export const REQ_TYPE_LABEL: Record<string, string> = {
  LEAVE: "Cuti",
  PERMIT: "Izin Acara",
  SICK: "Izin Sakit",
  ATTENDANCE_CORRECTION: "Koreksi Absen",
  SHIFT_SWAP: "Tukar Shift",
};

export const REQ_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

export function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "PENDING") return "secondary";
  return "outline";
}
