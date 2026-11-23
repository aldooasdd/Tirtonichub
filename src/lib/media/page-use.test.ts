import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, isUsePage, wibDay } from "./page-use";

test("halaman yang dicatat hanya dari daftar resmi", () => {
  assert.equal(isUsePage("pipeline"), true);
  assert.equal(isUsePage("card:qa"), true);
  assert.equal(isUsePage("toString"), false);
  assert.equal(isUsePage("x".repeat(500)), false);
  assert.equal(isUsePage(3), false);
});

test("hari WIB: pukul 23.30 UTC = besok di WIB", () => {
  assert.equal(wibDay(Date.UTC(2026, 10, 22, 23, 30)), "2026-11-23");
  assert.equal(wibDay(Date.UTC(2026, 10, 23, 5, 0), 6), "2026-11-17");
});

test("ringkasan: hari dipakai, jumlah buka, terakhir buka", () => {
  const s = summarize([
    { userId: "a", day: "2026-11-20", page: "pipeline", n: 3, lastAt: 10 },
    { userId: "a", day: "2026-11-21", page: "pipeline", n: 1, lastAt: 30 },
    { userId: "a", day: "2026-11-21", page: "bogus", n: 9, lastAt: 99 },
    { userId: "r", day: "2026-11-21", page: "script", n: 2, lastAt: 20 },
  ]);
  assert.deepEqual(s.a.pipeline, { days: 2, n: 4, lastAt: 30 });
  assert.equal(s.a.bogus, undefined);
  assert.deepEqual(s.r.script, { days: 1, n: 2, lastAt: 20 });
});
