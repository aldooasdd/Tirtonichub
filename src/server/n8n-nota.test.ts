import { test } from "node:test";
import assert from "node:assert";
import { priceFields } from "./n8n-nota";

test("priceFields: @Harga + Total Harga per baris (sesuai PI)", () => {
  // Diskon brand: @Harga=800000, total net=2240000, qty=4 → keduanya dipertahankan.
  assert.deepEqual(priceFields(4, 800000, 2240000), { unitPrice: 800000, totalPrice: 2240000 });
  // Tanpa total → total = @Harga × qty.
  assert.deepEqual(priceFields(3, 10000, 0), { unitPrice: 10000, totalPrice: 30000 });
  // Tanpa @Harga → @Harga = total / qty.
  assert.deepEqual(priceFields(2, 0, 20000), { unitPrice: 10000, totalPrice: 20000 });
  // qty 0 aman.
  assert.deepEqual(priceFields(0, 0, 0), { unitPrice: 0, totalPrice: 0 });
});
