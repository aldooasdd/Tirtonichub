// Kasir /pos: dari cabang mana stok barang diambil.
// 1) stok cabang sendiri cukup → cabang sendiri;
// 2) kurang → cabang lain dengan stok terbanyak;
// 3) beberapa cabang lain sama banyak → kasir memilih (tie).
// Tak ada cabang lain berstok → tetap cabang sendiri (stok jadi 0, dicatat).
export type BranchStock = { branchId: string | null; label: string; stock: number; mine: boolean };
export type Source = { from: string | null; tie: string[] | null };

export function pickSource(stocks: BranchStock[], qty: number): Source {
  const mapped = stocks.filter((s): s is BranchStock & { branchId: string } => !!s.branchId);
  const mine = mapped.find((s) => s.mine);
  if (mine && mine.stock >= qty) return { from: mine.branchId, tie: null };
  const others = mapped.filter((s) => !s.mine && s.stock > 0);
  if (!others.length) return { from: mine?.branchId ?? null, tie: null };
  const max = Math.max(...others.map((s) => s.stock));
  const top = others.filter((s) => s.stock === max);
  return top.length === 1 ? { from: top[0].branchId, tie: null } : { from: null, tie: top.map((s) => s.branchId) };
}
