// Sumber uang pembelian. Hanya KASIR yang mengurangi saldo cash laci kasir cabang.
export const CASHOUT_SOURCES = [
  { key: "KASIR", label: "Kasir (cash laci)" },
  { key: "MANDIRI", label: "Bank Mandiri" },
  { key: "BCA", label: "Bank BCA" },
  { key: "BRI", label: "Bank BRI" },
] as const;
export type CashoutSource = (typeof CASHOUT_SOURCES)[number]["key"];
export const isCashoutSource = (s: string): s is CashoutSource => CASHOUT_SOURCES.some((x) => x.key === s);
export const sourceLabel = (s: string | null | undefined) => CASHOUT_SOURCES.find((x) => x.key === s)?.label ?? "Kasir (cash laci)";
