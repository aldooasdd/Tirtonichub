import { test } from "node:test";
import assert from "node:assert/strict";
import { QA_DEFAULT, cprIdOf, cprYymm, critChecks, needsBrief, needsCpr, nextQa, qaAutoSubmit, qaBlocks, qaCfgOf, qaCfgWhy, qaOf, qaReopen, qaResult, qaScore, stockAtPublish, type Qa } from "./cpr";

const AT = 1_763_700_000_000;
const zaki = { name: "Zaki", code: "Z", full: true, staff: true };
const aulia = { name: "Aulia", code: "A", full: false, staff: true };
const rayhan = { name: "Rayhan", code: "R", full: false, staff: false };
const card = { type: "vrv", cprId: "TRT-CPR-VRV-2611-0001", status: "Ready", producer: "R", editor: "R", driveUrl: "/api/file?key=x", briefReq: true, brief: { ok: { v: 1, data: {} } } };
const IND = QA_DEFAULT.types.vrv;
const CHK = critChecks(IND, QA_DEFAULT.checks);
const all = (v: number) => Object.fromEntries(IND.map((i) => [i.k, v]));
const pass = Object.fromEntries(CHK.map((c) => [c.k, true]));
const submitted = () => {
  const q = nextQa(undefined, { act: "submit" }, card, rayhan, QA_DEFAULT, AT);
  assert.ok(typeof q === "object", String(q));
  return q;
};

test("Content ID: format, nomor 4 digit, bulan WIB", () => {
  assert.equal(cprIdOf("vrv", "2611", 3), "TRT-CPR-VRV-2611-0003");
  assert.equal(cprIdOf("igf", "2612", 12), "TRT-CPR-FIP-2612-0012");
  assert.equal(cprYymm(Date.UTC(2026, 10, 30, 17, 30)), "2612"); // 1 Des 00.30 WIB
  assert.equal(cprYymm(Date.UTC(2026, 10, 30, 16, 59)), "2611");
});

test("Content ID hanya untuk jenis yang tayang sebagai konten CPR", () => {
  for (const t of ["vpr", "igf", "vrv", "evt"]) assert.equal(needsCpr(t), true, t);
  for (const t of ["ktl", "khs", "cmp", "", undefined]) assert.equal(needsCpr(t), false, String(t));
});

test("standar QA bawaan sah: bobot tiap jenis 100%, Product Accuracy critical", () => {
  assert.equal(qaCfgWhy(QA_DEFAULT), null);
  assert.equal(QA_DEFAULT.types.igf.find((i) => i.k === "acc")?.c, true);
  assert.equal(QA_DEFAULT.types.vrv[0].w, 30);
  const bad = { ...QA_DEFAULT, types: { ...QA_DEFAULT.types, igf: QA_DEFAULT.types.igf.map((i) => (i.k === "acc" ? { ...i, w: 30 } : i)) } };
  assert.match(String(qaCfgWhy(bad)), /100%/);
  assert.equal(qaCfgOf(bad), QA_DEFAULT); // standar rusak → bawaan
  assert.equal(qaCfgOf({ ...QA_DEFAULT, v: 2 }).v, 2);
  assert.notEqual(qaCfgWhy({ ...QA_DEFAULT, checks: [] }), null);
});

test("skor: Σ nilai/5 × bobot; ≥60 eligible, 50–59 revisi, <50 major, critical gagal = blocked", () => {
  assert.equal(qaScore(IND, all(5)), 100);
  assert.equal(qaScore(IND, all(4)), 80);
  assert.equal(qaResult(60, 0), "eligible");
  assert.equal(qaResult(59.9, 0), "revision");
  assert.equal(qaResult(50, 0), "revision");
  assert.equal(qaResult(49, 0), "major");
  assert.equal(qaResult(100, 1), "blocked");
});

test("ajukan QA: hanya Editing/Ready, file final ada, brief wajib sudah disetujui", () => {
  const q = submitted();
  assert.equal(q.st, "submitted");
  assert.equal(q.ver, 1);
  assert.equal(q.inds.length, IND.length);
  assert.equal(q.sub?.file, card.driveUrl);
  assert.equal(typeof nextQa(undefined, { act: "submit" }, { ...card, status: "Terdata" }, rayhan, QA_DEFAULT, AT), "string");
  assert.equal(typeof nextQa(undefined, { act: "submit" }, { ...card, driveUrl: "" }, rayhan, QA_DEFAULT, AT), "string");
  assert.equal(typeof nextQa(undefined, { act: "submit" }, { ...card, brief: {} }, rayhan, QA_DEFAULT, AT), "string");
  assert.equal(typeof nextQa(undefined, { act: "submit" }, { ...card, briefReq: undefined, brief: {} }, rayhan, QA_DEFAULT, AT), "object"); // kartu lama: brief opsional
  assert.equal(typeof nextQa(undefined, { act: "submit" }, { ...card, cprId: "" }, rayhan, QA_DEFAULT, AT), "string");
  assert.equal(typeof nextQa(q, { act: "submit" }, card, rayhan, QA_DEFAULT, AT), "string"); // sudah diajukan
});

test("approve: lengkap, skor ≥60, semua critical Pass; anggota tidak bisa review", () => {
  const q = submitted();
  assert.equal(typeof nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: pass }, card, rayhan, QA_DEFAULT, AT), "string");
  const partial = { ...all(5) };
  delete partial.cta;
  assert.match(String(nextQa(q, { act: "review", decision: "approve", scores: partial, checks: pass }, card, aulia, QA_DEFAULT, AT)), /semua indikator/);
  assert.match(String(nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: { ...pass, rights: undefined } }, card, aulia, QA_DEFAULT, AT)), /critical check/);
  assert.match(String(nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: { ...pass, c_acc: false } }, card, aulia, QA_DEFAULT, AT)), /diblokir/);
  assert.match(String(nextQa(q, { act: "review", decision: "approve", scores: all(2), checks: pass }, card, aulia, QA_DEFAULT, AT)), /di bawah 60/);
  assert.equal((nextQa(q, { act: "review", decision: "approve", scores: all(3), checks: pass }, card, aulia, QA_DEFAULT, AT) as Qa).st, "approved"); // 60 lolos
  const ok = nextQa(q, { act: "review", decision: "approve", scores: all(4), checks: pass }, card, aulia, QA_DEFAULT, AT + 5) as Qa;
  assert.equal(ok.st, "approved");
  assert.equal(ok.appBy, "Aulia");
  assert.equal(ok.appAt, AT + 5);
  assert.equal(ok.rev?.score, 80);
  assert.equal(ok.log.at(-1)?.act, "approve");
});

test("revisi wajib catatan; status mengikuti skor/critical; pengajuan ulang = versi & riwayat baru", () => {
  const q = submitted();
  assert.match(String(nextQa(q, { act: "review", decision: "revise", scores: all(3), checks: pass, note: "" }, card, aulia, QA_DEFAULT, AT)), /catatan/);
  const r = nextQa(q, { act: "review", decision: "revise", scores: all(2), checks: pass, note: "audio pecah" }, card, aulia, QA_DEFAULT, AT) as Qa;
  assert.equal(r.st, "major");
  const b = nextQa(q, { act: "review", decision: "revise", scores: all(5), checks: { ...pass, info: false }, note: "harga salah" }, card, aulia, QA_DEFAULT, AT) as Qa;
  assert.equal(b.st, "blocked");
  assert.deepEqual(b.log.at(-1)?.fail, ["info"]);
  const r2 = nextQa(r, { act: "submit" }, card, rayhan, QA_DEFAULT, AT + 1) as Qa;
  assert.equal(r2.ver, 2);
  assert.equal(r2.st, "submitted");
  assert.equal(r2.rev, null);
  assert.equal(r2.log.length, 3);
});

test("self-approval: Admin 2 ditolak; admin penuh (Zaki) boleh tanpa alasan, alasan opsional tetap tercatat", () => {
  const q = submitted();
  const own = { ...card, editor: "A" };
  assert.match(String(nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: pass }, own, aulia, QA_DEFAULT, AT)), /admin lain/);
  const zOwn = { ...card, producer: "Z" };
  assert.equal((nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: pass }, zOwn, zaki, QA_DEFAULT, AT) as Qa).st, "approved");
  const ok = nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: pass, exc: "Aulia cuti, deadline payday" }, zOwn, zaki, QA_DEFAULT, AT) as Qa;
  assert.equal(ok.st, "approved");
  assert.equal(ok.log.at(-1)?.exc, "Aulia cuti, deadline payday");
});

test("perubahan file final / info produk setelah Approved membuka QA kembali", () => {
  const q = submitted();
  const ok = nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: pass }, card, aulia, QA_DEFAULT, AT) as Qa;
  assert.equal(qaReopen(ok, card, { ...card, note: "x" }, "Rayhan"), null);
  const r = qaReopen(ok, card, { ...card, driveUrl: "/api/file?key=y" }, "Rayhan");
  assert.equal(r?.st, "reopened");
  assert.match(String(r?.log.at(-1)?.note), /file final/);
  assert.equal(qaReopen(undefined, card, { ...card, driveUrl: "z" }, "R"), null);
  assert.equal(typeof nextQa(r, { act: "submit" }, card, rayhan, QA_DEFAULT, AT), "object");
});

test("Tayang & jadwal Meta ditolak sebelum QA Approved (hanya kartu ber-qaReq)", () => {
  const b = { status: "Ready", qaReq: true, type: "vrv" };
  assert.notEqual(qaBlocks(b, { ...b, status: "Tayang" }), null);
  assert.notEqual(qaBlocks(b, { ...b, metaAt: 123 }), null);
  assert.equal(qaBlocks(b, { ...b, note: "x" }), null);
  const q = submitted();
  assert.notEqual(qaBlocks(b, { ...b, status: "Tayang", qa: q }), null); // baru diajukan belum cukup
  const ok = nextQa(q, { act: "review", decision: "approve", scores: all(5), checks: pass }, card, aulia, QA_DEFAULT, AT);
  assert.equal(qaBlocks(b, { ...b, status: "Tayang", qa: ok }), null);
  assert.equal(qaBlocks(b, { ...b, status: "Tayang", qa: { st: "ok" } }), null); // QA lama (6 centang) yang sudah lolos tetap sah
  assert.equal(qaBlocks({ status: "Ready" }, { status: "Tayang" }), null);
  assert.equal(qaBlocks({ status: "Ready", qaReq: true, type: "khs" }, { status: "Tayang", qaReq: true, type: "khs" }), null);
});

test("QA lama dibaca aman; isi sampah dibersihkan", () => {
  const old = qaOf({ st: "ok", by: "Zaki", at: 5, g: { pf: true }, log: [{ st: "ok", at: 5, by: "Zaki" }, null, "x"] });
  assert.equal(old.st, "approved");
  assert.equal(old.appBy, "Zaki");
  assert.equal(old.log.length, 1);
  assert.equal(qaOf({ st: "hack" }).st, "none");
  assert.equal(qaOf({ sys: 2, st: "hack" }).st, "none");
  assert.equal(qaOf(undefined).st, "none");
});

test("masuk Ready / ganti file saat Ready = Creative Review diajukan otomatis; syarat kurang atau sudah diajukan = diam", () => {
  const edit = { ...card, status: "Editing" };
  const q = qaAutoSubmit(edit, card, "Rayhan", QA_DEFAULT, AT);
  assert.equal(q?.st, "submitted");
  assert.equal(q?.sub?.by, "Rayhan");
  assert.equal(qaAutoSubmit(card, card, "Rayhan"), null); // tetap Ready, file sama
  assert.equal(qaAutoSubmit(edit, { ...card, qa: q }, "Rayhan"), null); // sudah diajukan
  assert.equal(qaAutoSubmit(edit, { ...card, driveUrl: "" }, "Rayhan"), null); // file final belum ada
  assert.equal(qaAutoSubmit(edit, { ...card, brief: {} }, "Rayhan"), null); // brief belum disetujui
  assert.equal(qaAutoSubmit(edit, { ...card, cprId: "" }, "Rayhan"), null); // tanpa Content ID
  assert.equal(qaAutoSubmit(edit, { ...card, type: "ktl" }, "Rayhan"), null);
  assert.equal(qaAutoSubmit(null, card, "Rayhan"), null); // kartu baru
  assert.equal(qaAutoSubmit(edit, { ...card, status: "Editing" }, "Rayhan"), null); // belum Ready
  // revisi lalu file diganti saat masih Ready → diajukan ulang (versi naik)
  const rev = nextQa(q, { act: "review", scores: all(2), checks: pass, note: "warna kurang", decision: "revise" }, card, zaki, QA_DEFAULT, AT);
  assert.ok(typeof rev === "object");
  assert.equal(qaAutoSubmit(card, { ...card, qa: rev }, "Rayhan"), null); // revisi tanpa ganti file: tidak diajukan sendiri
  const again = qaAutoSubmit(card, { ...card, qa: rev, driveUrl: "/api/file?key=y" }, "Rayhan", QA_DEFAULT, AT);
  assert.equal(again?.st, "submitted");
  assert.equal(again?.ver, 2);
});

test("IDCC: Content ID, pinjam standar, Foto IDCC tanpa brief, stok awal", () => {
  assert.equal(cprIdOf("idc", "2611", 7), "TRT-CPR-IDCC-2611-0007");
  assert.equal(cprIdOf("idf", "2611", 8), "TRT-CPR-IDCC-2611-0008");
  assert.equal(needsBrief("idc"), true);
  assert.equal(needsBrief("idf"), false);
  // standar tersimpan tanpa IDCC tetap sah dan tidak kembali ke bawaan
  const saved = { ...QA_DEFAULT, v: 5, types: { ...QA_DEFAULT.types, vrv: [{ k: "a", l: "A", w: 60 }, { k: "b", l: "B", w: 40 }] } };
  assert.equal(qaCfgWhy(saved), null);
  const cfg = qaCfgOf(saved);
  assert.equal(cfg.v, 5);
  assert.deepEqual(cfg.types.idc.map((i) => i.k), ["a", "b"]);
  const who = { name: "R", code: "R", full: false, staff: false };
  const c = { type: "idf", cprId: "X", status: "Ready", driveUrl: "/f" };
  const q = nextQa(undefined, { act: "submit" }, c, who, cfg);
  assert.ok(typeof q !== "string" && q.inds[0].k === "acc" && !q.checks.some((x) => x.k === "brief"));
  assert.equal(typeof nextQa(undefined, { act: "submit" }, { ...c, type: "idc", briefReq: true }, who, cfg), "string");
  assert.ok(qaBlocks({ status: "Ready" }, { type: "idf", qaReq: true, status: "Tayang" }));
  const pub = { type: "idc", cprId: "X", status: "Tayang" };
  assert.deepEqual(stockAtPublish({ status: "Ready" }, pub, 12, 1), { n: 12, at: 1 });
  assert.deepEqual(stockAtPublish({ status: "Ready" }, pub, null, 1), { n: null, at: 1 });
  assert.equal(stockAtPublish({ status: "Tayang" }, pub, 12), undefined);
  assert.equal(stockAtPublish({ status: "Ready" }, { ...pub, stock0: { n: 1, at: 1 } }, 12), undefined);
  assert.equal(stockAtPublish({ status: "Ready" }, { ...pub, type: "vrv" }, 12), undefined);
});
