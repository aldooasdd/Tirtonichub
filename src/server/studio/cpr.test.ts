import { test } from "node:test";
import assert from "node:assert/strict";
import { cprIdOf, cprYymm, needsCpr, nextQa, qaBlocks, qaOf, QA_GATES, QA_LOG_MAX } from "./cpr";

const AT = 1_763_700_000_000;
const zaki = { name: "Zaki", code: "Z", full: true, staff: true };
const aulia = { name: "Aulia", code: "A", full: false, staff: true };
const rayhan = { name: "Rayhan", code: "R", full: false, staff: false };
const ALL = Object.fromEntries(QA_GATES.map((k) => [k, true]));
const card = { type: "vrv", cprId: "TRT-CPR-VRV-2611-0001", status: "Ready", producer: "R", editor: "R" };

test("Content ID: format, nomor 4 digit, bulan WIB", () => {
  assert.equal(cprIdOf("vrv", "2611", 3), "TRT-CPR-VRV-2611-0003");
  assert.equal(cprIdOf("igf", "2612", 12), "TRT-CPR-FIP-2612-0012");
  assert.equal(cprYymm(Date.UTC(2026, 10, 30, 17, 30)), "2612"); // 1 Des 00.30 WIB
  assert.equal(cprYymm(Date.UTC(2026, 10, 30, 16, 59)), "2611");
});

test("Content ID hanya untuk jenis yang tayang sebagai konten CPR", () => {
  for (const t of ["vpr", "igf", "vrv", "evt", "idf", "idc"]) assert.equal(needsCpr(t), true, t);
  for (const t of ["ktl", "khs", "cmp", "", undefined]) assert.equal(needsCpr(t), false, String(t));
});

test("QA lolos hanya bila keenam pemeriksaan dicentang", () => {
  const q = nextQa(undefined, { st: "ok", g: ALL }, card, zaki, AT);
  assert.equal(typeof q, "object");
  if (typeof q === "string") return;
  assert.equal(q.st, "ok");
  assert.equal(q.by, "Zaki");
  assert.equal(q.at, AT);
  assert.equal(q.round, 1);
  assert.equal(typeof nextQa(undefined, { st: "ok", g: { ...ALL, rc: false } }, card, zaki, AT), "string");
});

test("anggota tidak bisa QA; Admin 2 tidak meloloskan kontennya sendiri", () => {
  assert.equal(typeof nextQa(undefined, { st: "ok", g: ALL }, card, rayhan, AT), "string");
  assert.equal(typeof nextQa(undefined, { st: "ok", g: ALL }, { ...card, editor: "A" }, aulia, AT), "string");
  assert.equal(typeof nextQa(undefined, { st: "ok", g: ALL }, card, aulia, AT), "object");
});

test("revisi wajib catatan dan pemeriksaan yang gagal; putaran & riwayat tersimpan", () => {
  assert.equal(typeof nextQa(undefined, { st: "revisi", g: { ...ALL, te: false } }, card, zaki, AT), "string");
  assert.equal(typeof nextQa(undefined, { st: "revisi", g: ALL, note: "audio pecah" }, card, zaki, AT), "string");
  const r1 = nextQa(undefined, { st: "revisi", g: { ...ALL, te: false }, note: "audio pecah" }, card, zaki, AT);
  assert.ok(typeof r1 === "object");
  assert.deepEqual(r1.log[0].fail, ["te"]);
  const r2 = nextQa(r1, { st: "ok", g: ALL }, card, zaki, AT + 1);
  assert.ok(typeof r2 === "object");
  assert.equal(r2.round, 2);
  assert.equal(r2.log.length, 2);
});

test("QA hanya saat Editing/Ready dan hanya untuk kartu ber-Content ID", () => {
  assert.equal(typeof nextQa(undefined, { st: "ok", g: ALL }, { ...card, status: "Terdata" }, zaki, AT), "string");
  assert.equal(typeof nextQa(undefined, { st: "ok", g: ALL }, { ...card, cprId: "" }, zaki, AT), "string");
  assert.equal(typeof nextQa(undefined, { st: "ok", g: ALL }, { ...card, type: "ktl" }, zaki, AT), "string");
  assert.equal(typeof nextQa(undefined, { st: "lolos" }, card, zaki, AT), "string");
});

test("Tayang & jadwal Meta ditolak sebelum QA lolos (hanya kartu baru ber-QA)", () => {
  const b = { status: "Ready", qaReq: true };
  assert.notEqual(qaBlocks(b, { ...b, status: "Tayang" }), null);
  assert.notEqual(qaBlocks(b, { ...b, metaAt: 123 }), null);
  assert.equal(qaBlocks(b, { ...b, note: "x" }), null);
  const ok = { ...b, qa: { st: "ok" } };
  assert.equal(qaBlocks(ok, { ...ok, status: "Tayang" }), null);
  // kartu lama (tanpa qaReq) tidak terpengaruh
  assert.equal(qaBlocks({ status: "Ready" }, { status: "Tayang" }), null);
  // sudah Tayang sebelumnya: perubahan lain tetap boleh
  assert.equal(qaBlocks({ status: "Tayang", qaReq: true }, { status: "Tayang", qaReq: true, note: "x" }), null);
});

test("isi QA sampah dibersihkan, riwayat dibatasi", () => {
  const q = qaOf({ st: "hack", g: { pf: "yes", bi: true }, log: [null, "x", { st: "boom" }] });
  assert.equal(q.st, "pending");
  assert.equal(q.g.pf, false);
  assert.equal(q.g.bi, true);
  assert.equal(q.log.length, 0);
  let prev: unknown;
  for (let i = 0; i < QA_LOG_MAX + 5; i++) {
    const r = nextQa(prev, { st: "revisi", g: { ...ALL, pf: false }, note: "cek harga" }, card, zaki, AT + i);
    assert.ok(typeof r === "object");
    prev = r;
  }
  assert.equal(qaOf(prev).log.length, QA_LOG_MAX);
});
