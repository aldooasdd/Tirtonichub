import { test } from "node:test";
import assert from "node:assert/strict";
import { briefBlocks, briefDataWhy, nextBrief, type Brief } from "./brief";

const AT = 1_763_700_000_000;
const aulia = { name: "Aulia", code: "A", full: false, staff: true };
const rayhan = { name: "Rayhan", code: "R", full: false, staff: false };
const card = { type: "vrv", status: "Terdata", producer: "R", briefReq: true };
const FULL = { pillar: "Educate", audience: "Pemain pemula 18–30", objective: "Paham beda raket", message: "Ringan & stabil", hook: "Raket 270 gram?", direction: "Close-up frame, lapangan sore", cta: "DM untuk cek stok", refs: ["https://instagram.com/p/x"] };
const ok = (b: Brief | string) => {
  assert.ok(typeof b === "object", String(b));
  return b;
};

test("isi brief divalidasi: pillar, panjang teks, link referensi https", () => {
  assert.equal(briefDataWhy(FULL), null);
  assert.notEqual(briefDataWhy({ ...FULL, pillar: "Awareness" }), null);
  assert.notEqual(briefDataWhy({ ...FULL, refs: ["http://x"] }), null);
  assert.notEqual(briefDataWhy({ ...FULL, audience: "x".repeat(301) }), null);
  assert.notEqual(briefDataWhy({ ...FULL, hack: 1 }), null);
});

test("draf → ajukan (wajib lengkap) → disetujui Creative Lead; anggota tidak bisa menyetujui", () => {
  const d = ok(nextBrief(undefined, { act: "save", data: { pillar: "Educate" } }, card, rayhan, AT));
  assert.equal(d.st, "draft");
  assert.match(String(nextBrief(d, { act: "submit" }, card, rayhan, AT)), /lengkapi/);
  const s = ok(nextBrief(d, { act: "submit", data: FULL }, card, rayhan, AT));
  assert.equal(s.st, "submitted");
  assert.match(String(nextBrief(s, { act: "approve" }, card, rayhan, AT)), /Creative Lead/);
  const a = ok(nextBrief(s, { act: "approve" }, card, aulia, AT + 1));
  assert.equal(a.st, "approved");
  assert.equal(a.ok?.by, "Aulia");
  assert.equal(a.ok?.v, 1);
  assert.deepEqual(a.log.map((e) => e.act), ["save", "submit", "approve"]);
});

test("revisi wajib catatan; mengubah brief yang disetujui membuat versi baru, persetujuan lama tetap tercatat", () => {
  const s = ok(nextBrief(undefined, { act: "submit", data: FULL }, card, rayhan, AT));
  assert.match(String(nextBrief(s, { act: "revisi", note: "" }, card, aulia, AT)), /catatan/);
  const r = ok(nextBrief(s, { act: "revisi", note: "hook kurang tajam" }, card, aulia, AT));
  assert.equal(r.st, "revisi");
  const a = ok(nextBrief(ok(nextBrief(r, { act: "submit", data: { ...FULL, hook: "Raket paling stabil?" } }, card, rayhan, AT)), { act: "approve" }, card, aulia, AT));
  const v2 = ok(nextBrief(a, { act: "save", data: { ...a.data, cta: "Klik link bio" } }, card, rayhan, AT));
  assert.equal(v2.v, 2);
  assert.equal(v2.st, "draft");
  assert.equal(v2.ok?.v, 1); // versi 1 tetap disetujui
  assert.deepEqual(v2.log.at(-1)?.ch, ["CTA"]);
  assert.deepEqual(ok(nextBrief(v2, { act: "save", data: v2.data }, card, rayhan, AT)).log.length, v2.log.length); // tanpa perubahan
});

test("brief hanya untuk 4 jenis CPR", () => {
  assert.equal(typeof nextBrief(undefined, { act: "save", data: FULL }, { ...card, type: "ktl" }, aulia, AT), "string");
});

test("kartu wajib brief tidak bisa ke Produksi sebelum brief disetujui", () => {
  const before = { ...card };
  assert.notEqual(briefBlocks(before, { ...card, status: "Diproduksi" }), null);
  assert.notEqual(briefBlocks(before, { ...card, status: "Editing" }), null);
  assert.equal(briefBlocks(before, { ...card, note: "x" }), null);
  assert.equal(briefBlocks(before, { ...card, status: "Diproduksi", brief: { ok: { v: 1 } } }), null);
  assert.equal(briefBlocks({ ...card, briefReq: undefined }, { ...card, briefReq: undefined, status: "Diproduksi" }), null); // kartu lama
  assert.equal(briefBlocks({ ...card, status: "Diproduksi" }, { ...card, status: "Editing" }), null); // sudah lewat Terdata
  assert.equal(briefBlocks(null, { ...card, status: "Diproduksi" }), null);
});
