import { test } from "node:test";
import assert from "node:assert/strict";
import { akunOf, TAK_TERPETAKAN, TUNAI } from "./rekening";

test("akunOf: metode nota → rekening", () => {
  assert.equal(akunOf("QRIS BCA"), "BCA - Tirtonic Global");
  assert.equal(akunOf("qris  bca"), "BCA - Tirtonic Global");
  assert.equal(akunOf("Debit Selain Mandiri"), "Bank Mandiri - Bisnis");
  assert.equal(akunOf("Transfer BRI"), "BRI - an Yupie Milenia");
  assert.equal(akunOf("Shopee"), "BCA - Tirtonic Global");
  assert.equal(akunOf("Tunai"), TUNAI);
  assert.equal(akunOf("OVO"), TAK_TERPETAKAN);
});
