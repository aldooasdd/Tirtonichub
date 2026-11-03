import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, notaBuckets } from "./cash";

test("bucketOf: transfer & online tak masuk kasir", () => {
  assert.equal(bucketOf("Transfer BCA"), null);
  assert.equal(bucketOf("SHOPEE"), null);
  assert.equal(bucketOf("QRIS BRI"), "bri");
  assert.equal(bucketOf("Tunai"), "cash");
});

test("notaBuckets: kembalian dipotong dari cash", () => {
  assert.deepEqual(notaBuckets([{ method: "Tunai", amount: 500000 }], 450000), { cash: 450000, mandiri: 0, bca: 0, bri: 0 });
  assert.deepEqual(notaBuckets([{ method: "Debit BCA", amount: 300000 }, { method: "Tunai", amount: 200000 }], 480000), { cash: 180000, mandiri: 0, bca: 300000, bri: 0 });
  assert.deepEqual(notaBuckets([{ method: "Transfer BRI", amount: 100000 }], 100000), { cash: 0, mandiri: 0, bca: 0, bri: 0 });
});
