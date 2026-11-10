import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSource, type BranchStock } from "./pos-source";

const s = (branchId: string, stock: number, mine = false): BranchStock => ({ branchId, label: branchId, stock, mine });

test("stok cabang sendiri cukup → cabang sendiri", () => {
  assert.deepEqual(pickSource([s("jog", 2, true), s("solo", 9)], 2), { from: "jog", tie: null });
});
test("stok sendiri kurang → cabang lain terbanyak", () => {
  assert.deepEqual(pickSource([s("jog", 0, true), s("solo", 3), s("smg", 5)], 1), { from: "smg", tie: null });
});
test("cabang lain sama banyak → kasir pilih", () => {
  assert.deepEqual(pickSource([s("jog", 0, true), s("solo", 4), s("smg", 4)], 1), { from: null, tie: ["solo", "smg"] });
});
test("tak ada stok di mana pun → tetap cabang sendiri", () => {
  assert.deepEqual(pickSource([s("jog", 0, true), s("solo", 0)], 1), { from: "jog", tie: null });
});
test("gudang belum dipetakan diabaikan", () => {
  assert.deepEqual(pickSource([{ branchId: null, label: "Gudang X", stock: 9, mine: false }], 1), { from: null, tie: null });
});
