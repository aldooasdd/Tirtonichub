import { test } from "node:test";
import assert from "node:assert/strict";
import { channelOf, monthRange } from "./online-recon";

test("channelOf", () => {
  assert.equal(channelOf("SHOPEE"), "SHOPEE");
  assert.equal(channelOf("Tokopedia"), "TOKOPEDIA");
  assert.equal(channelOf("WEBSITE"), "WEBSITE");
  assert.equal(channelOf("QRIS BCA"), null);
});

test("monthRange WIB", () => {
  const { from, to } = monthRange("2026-12");
  assert.equal(from.toISOString(), "2026-11-30T17:00:00.000Z");
  assert.equal(to.toISOString(), "2026-12-31T17:00:00.000Z");
});
