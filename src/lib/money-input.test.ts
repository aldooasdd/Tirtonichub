import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDec, fmtInt, parseDec, parseInt0 } from "./money-input";

test("fmtInt/parseInt0", () => {
  assert.equal(fmtInt(1250000), "1.250.000");
  assert.equal(fmtInt("1.2500"), "12.500"); // ketik angka setelah titik → format ulang
  assert.equal(fmtInt(0), "");
  assert.equal(fmtInt(999), "999");
  assert.equal(parseInt0("1.250.000"), 1250000);
  assert.equal(parseInt0(""), 0);
});

test("fmtDec/parseDec", () => {
  assert.equal(fmtDec(108109.38), "108.109,38");
  assert.equal(fmtDec("108109."), "108.109,"); // koma baru diketik
  assert.equal(fmtDec("10.9375"), "10,9375");
  assert.equal(parseDec("108.109,38"), "108109.38");
  assert.equal(parseDec("108.109,"), "108109.");
  assert.equal(parseDec("1.2345"), "12345");
  assert.equal(fmtDec(parseDec("30.166,67")), "30.166,67");
});
