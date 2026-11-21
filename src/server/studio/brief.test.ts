import { test } from "node:test";
import assert from "node:assert/strict";
import { briefBlocks, briefCompat, briefDataWhy, nextBrief, type Brief } from "./brief";
import { BRIEF_DEFAULT, briefCfgWhy, PRIMARY } from "./brief-master";

const AT = 1_763_700_000_000;
const aulia = { name: "Aulia", code: "A", full: false, staff: true };
const rayhan = { name: "Rayhan", code: "R", full: false, staff: false };
const zaki = { name: "Zaki", code: "Z", full: true, staff: true };
const card = { type: "vrv", status: "Terdata", producer: "R", briefReq: true };
const FULL = { pillar: "Educate", primary: "ENT", cobj: "ENT-PE", sec: ["QIN"], aud: { level: ["LV-BEG"], interest: ["PI-RKT"], geo: ["GE-YOG"] }, km: "KM-PED", hk: "HK-PSU", ct: "CT-PCS", direction: "Close-up frame, lapangan sore", refs: ["https://instagram.com/p/x"] };
const ok = (b: Brief | string) => {
  assert.ok(typeof b === "object", String(b));
  return b;
};

test("seed master sesuai ketentuan final: 5 Primary, 22 Content Objective, 5 kategori audience, preset per jenis", () => {
  assert.equal(briefCfgWhy(BRIEF_DEFAULT), null);
  assert.deepEqual(PRIMARY.map((p) => p.l), ["Awareness", "Engagement & Trust", "Qualified Inquiry", "Conversion", "Retention"]);
  assert.equal(BRIEF_DEFAULT.cobj.length, 22);
  assert.equal(BRIEF_DEFAULT.cobj.filter((c) => c.p === "ENT").length, 5);
  assert.deepEqual(BRIEF_DEFAULT.aud.map((g) => g.o.length), [4, 4, 5, 4, 5]);
  assert.deepEqual(BRIEF_DEFAULT.presets.igf, { p: "QIN", s: ["ENT"], km: "KM-PCF", hk: "HK-PHL", ct: "CT-PCS" });
  assert.equal(BRIEF_DEFAULT.presets["evt:promo"].p, "CNV");
  assert.equal(BRIEF_DEFAULT.presets["evt:community"].p, "ENT");
});

test("master: ID lama tidak boleh hilang, hanya boleh dinonaktifkan", () => {
  const drop = { ...BRIEF_DEFAULT, km: BRIEF_DEFAULT.km.slice(0, -1) };
  assert.match(String(briefCfgWhy(drop, BRIEF_DEFAULT)), /tidak boleh dihapus/);
  const off = { ...BRIEF_DEFAULT, km: BRIEF_DEFAULT.km.map((k, i) => (i ? k : { ...k, a: false })) };
  assert.equal(briefCfgWhy(off, BRIEF_DEFAULT), null);
  const add = { ...BRIEF_DEFAULT, cobj: [...BRIEF_DEFAULT.cobj, { id: "RET-XX", l: "Baru", p: "RET", a: true }] };
  assert.equal(briefCfgWhy(add, BRIEF_DEFAULT), null);
  assert.notEqual(briefCfgWhy({ ...BRIEF_DEFAULT, cobj: [...BRIEF_DEFAULT.cobj, { id: "X-1", l: "y", p: "ZZZ" }] }), null);
});

test("isi brief: hanya master ID; secondary ≤2 dan ≠ primary; referensi https", () => {
  assert.equal(briefDataWhy(FULL), null);
  assert.notEqual(briefDataWhy({ ...FULL, primary: "Awareness" }), null);
  assert.notEqual(briefDataWhy({ ...FULL, cobj: "teks bebas" }), null);
  assert.notEqual(briefDataWhy({ ...FULL, sec: ["AWR", "QIN", "CNV"] }), null);
  assert.notEqual(briefDataWhy({ ...FULL, sec: ["ENT"] }), null);
  assert.notEqual(briefDataWhy({ ...FULL, aud: { level: ["Pemula"] } }), null);
  assert.notEqual(briefDataWhy({ ...FULL, aud: { umur: [] } }), null);
  assert.notEqual(briefDataWhy({ ...FULL, km: "KM-XXX" }), null);
  assert.notEqual(briefDataWhy({ ...FULL, refs: ["http://x"] }), null);
  assert.notEqual(briefDataWhy({ ...FULL, hack: 1 }), null);
});

test("ganti Primary Objective: pilihan lama tidak dihapus, tetapi ditandai tidak cocok dan menahan pengajuan", () => {
  const d = ok(nextBrief(undefined, { act: "save", data: { ...FULL, primary: "CNV", sec: [] } }, card, zaki));
  assert.equal(d.data.km, "KM-PED"); // tetap tersimpan
  const w = briefCompat(d.data, "vrv");
  assert.ok(w.some((x) => /Key Message/.test(x)));
  assert.match(String(nextBrief(d, { act: "submit" }, card, zaki)), /perbaiki dulu/);
  assert.deepEqual(briefCompat(FULL as never, "vrv"), []);
  assert.ok(briefCompat({ ...FULL, km: "KM-PRM" } as never, "vrv").length > 0); // Promotion bukan untuk Video review
});

test("Video event wajib subkategori Promo / Community", () => {
  const evt = { ...card, type: "evt" };
  const D = { ...FULL, primary: "CNV", cobj: "CNV-PM", sec: ["AWR"], km: "KM-PRM", hk: "HK-LTO", ct: "CT-CPU" };
  assert.match(String(nextBrief(undefined, { act: "submit", data: D }, evt, zaki)), /Subkategori/);
  ok(nextBrief(undefined, { act: "submit", data: { ...D, evtSub: "promo" } }, evt, zaki));
});

test("draf → ajukan (lengkap) → disetujui Creative Lead; anggota tidak bisa menyetujui", () => {
  const d = ok(nextBrief(undefined, { act: "save", data: { pillar: "Educate" } }, card, zaki, BRIEF_DEFAULT, AT));
  assert.equal(d.st, "draft");
  assert.match(String(nextBrief(d, { act: "submit" }, card, zaki)), /lengkapi/);
  const s = ok(nextBrief(d, { act: "submit", data: FULL }, card, zaki, BRIEF_DEFAULT, AT));
  assert.equal(s.st, "submitted");
  assert.match(String(nextBrief(s, { act: "approve" }, card, rayhan)), /admin/);
  const a = ok(nextBrief(s, { act: "approve" }, card, aulia, BRIEF_DEFAULT, AT + 1));
  assert.equal(a.st, "approved");
  assert.equal(a.ok?.by, "Aulia");
  assert.deepEqual(a.log.map((e) => e.act), ["save", "submit", "approve"]);
});

test("objective diubah setelah disetujui → versi baru, perlu disetujui ulang, tercatat di riwayat", () => {
  const a = ok(nextBrief(ok(nextBrief(undefined, { act: "submit", data: FULL }, card, zaki)), { act: "approve" }, card, aulia));
  const v2 = ok(nextBrief(a, { act: "save", data: { ...FULL, cobj: "ENT-PC" } }, card, zaki));
  assert.equal(v2.v, 2);
  assert.equal(v2.st, "draft");
  assert.equal(v2.ok?.v, 1);
  assert.deepEqual(v2.log.at(-1)?.ch, ["Content Objective"]);
  const r = ok(nextBrief(ok(nextBrief(v2, { act: "submit" }, card, zaki)), { act: "revisi", note: "hook kurang tajam" }, card, aulia));
  assert.equal(r.st, "revisi");
  assert.match(String(nextBrief(r, { act: "revisi", note: "" }, card, aulia)), /catatan/);
});

test("anggota (B1) tidak bisa menyusun atau mengajukan brief", () => {
  assert.match(String(nextBrief(undefined, { act: "save", data: FULL }, card, rayhan)), /admin/);
  assert.match(String(nextBrief(undefined, { act: "submit", data: FULL }, card, rayhan)), /admin/);
});

test("Foto IG / Video produk: tanpa Content Objective dan Key Message/Hook/CTA tetap bisa diajukan", () => {
  const igf = { ...card, type: "igf" };
  ok(nextBrief(undefined, { act: "submit", data: { pillar: "Convert", primary: "QIN", aud: { geo: ["GE-NAS"] }, direction: "Flatlay" } }, igf, zaki));
  assert.match(String(nextBrief(undefined, { act: "submit", data: { pillar: "Educate", primary: "ENT", aud: { geo: ["GE-NAS"] }, direction: "x" } }, card, zaki)), /Key Message/);
});

test("brief hanya untuk 4 jenis CPR", () => {
  assert.equal(typeof nextBrief(undefined, { act: "save", data: FULL }, { ...card, type: "ktl" }, aulia), "string");
});

test("kartu wajib brief tidak bisa ke Produksi sebelum brief disetujui", () => {
  const before = { ...card };
  assert.notEqual(briefBlocks(before, { ...card, status: "Diproduksi" }), null);
  assert.equal(briefBlocks(before, { ...card, note: "x" }), null);
  assert.equal(briefBlocks(before, { ...card, status: "Diproduksi", brief: { ok: { v: 1 } } }), null);
  assert.equal(briefBlocks({ ...card, briefReq: undefined }, { ...card, briefReq: undefined, status: "Diproduksi" }), null);
  assert.equal(briefBlocks({ ...card, status: "Diproduksi" }, { ...card, status: "Editing" }), null);
});
