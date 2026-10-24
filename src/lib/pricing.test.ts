import { test } from "node:test";
import assert from "node:assert";
import { computeSellPrice } from "./pricing";

test("computeSellPrice = unitPrice*1.35*1.15, ceil ke 5000", () => {
  assert.equal(computeSellPrice(20000), 35000); // 31050 → 35000
  assert.equal(computeSellPrice(100000), 160000); // 155250 → 160000
  assert.equal(computeSellPrice(0), 0);
});
