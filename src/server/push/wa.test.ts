import { test } from "node:test";
import assert from "node:assert/strict";
import { katalogOnly, waText } from "./logic";

test("waText: judul tebal, isi, tautan lengkap", () => {
  process.env.APP_URL = "https://tirtonichub.com/";
  assert.equal(
    waText({ title: 'Foto katalog "A.jpg" ready', body: "Wilson Pro Staff", url: "/studio/?p=hasil" }),
    '*Foto katalog "A.jpg" ready*\nWilson Pro Staff\n\nBuka Tirtonic Studio: https://tirtonichub.com/studio/?p=hasil',
  );
});

test("waText: tanpa isi", () => {
  process.env.APP_URL = "https://tirtonichub.com";
  assert.equal(waText({ title: "Barang masuk", url: "/studio/" }), "*Barang masuk*\n\nBuka Tirtonic Studio: https://tirtonichub.com/studio/");
});

test("katalogOnly: bawaan ridho, bisa diatur lewat env", () => {
  delete process.env.PUSH_KATALOG_EMAILS;
  assert.deepEqual(katalogOnly(), ["ridho@tirtonichub.com"]);
  process.env.PUSH_KATALOG_EMAILS = " A@x.com, b@x.com ";
  assert.deepEqual(katalogOnly(), ["a@x.com", "b@x.com"]);
  delete process.env.PUSH_KATALOG_EMAILS;
});
