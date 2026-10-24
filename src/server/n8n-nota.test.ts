import { test } from "node:test";
import assert from "node:assert";
import { computeUnitPrice } from "./n8n-nota";

test("computeUnitPrice = (total/qty) * 1.11", () => {
  assert.equal(computeUnitPrice(2, 20000, 0), 11100); // 10000 * 1.11
  assert.equal(computeUnitPrice(1, 0, 10000), 11100); // tanpa total → harga satuan * 1.11
  assert.equal(computeUnitPrice(0, 0, 0), 0); // qty 0 aman, tak ada harga
  assert.equal(computeUnitPrice(3, 30000, 5000), 11100); // total diutamakan atas unitPrice
});
