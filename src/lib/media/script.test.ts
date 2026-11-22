import { test } from "node:test";
import assert from "node:assert/strict";
import { commentWhy, contentWhy, needSnapshot, plainText, refreshImages, reviewWhy, scriptEligible, seedDoc, statusAfterEdit, submitWhy } from "./script";

const t = (type: string, cprId: string | null, extra?: unknown) => ({ id: "t1", type, cprId, extra });

test("hanya Video review & Video event dengan Content ID", () => {
  assert.equal(scriptEligible(t("vrv", "TRT-CPR-VRV-2611-0001")), null);
  assert.equal(scriptEligible(t("evt", "TRT-CPR-VEV-2611-0002")), null);
  for (const ty of ["vpr", "igf", "ktl", "idc", "cmp"]) assert.ok(scriptEligible(t(ty, "TRT-X")));
  assert.ok(scriptEligible(t("vrv", null)));
  assert.ok(scriptEligible(t("vrv", "X", { mergedInto: "t2" })));
  assert.ok(scriptEligible(null));
});

test("dokumen awal sah, dengan dan tanpa foto", () => {
  assert.equal(contentWhy(seedDoc("vrv", { src: "/api/file?key=media/abc.jpg", ref: "item:ck1" })), null);
  const noPhoto = seedDoc("evt", null);
  assert.equal(contentWhy(noPhoto), null);
  assert.match(plainText(noPhoto), /Belum ada foto/);
});

test("isi berbahaya ditolak", () => {
  const doc = (n: unknown) => ({ type: "doc", content: [n] });
  const para = (marks: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text: "x", marks }] });
  assert.ok(contentWhy(doc({ type: "script" })));
  assert.ok(contentWhy(doc(para([{ type: "link", attrs: { href: "javascript:alert(1)" } }]))));
  assert.ok(contentWhy(doc(para([{ type: "textStyle", attrs: { color: "red;background:url(x)" } }]))));
  assert.ok(contentWhy(doc(para([{ type: "textStyle", attrs: { fontFamily: "Evil<script>" } }]))));
  assert.ok(contentWhy(doc({ type: "paragraph", content: [{ type: "image", attrs: { src: "https://evil.com/a.png" } }] })));
  assert.ok(contentWhy(doc(para([{ type: "onclick" }]))));
  assert.ok(contentWhy({ type: "paragraph" }));
  assert.equal(contentWhy(doc(para([{ type: "link", attrs: { href: "https://tirtonic.id", target: "_blank", rel: "noopener" } }, { type: "textStyle", attrs: { color: "#c34646", fontFamily: '"Times New Roman"', fontSize: "14px", lineHeight: "1.5" } }, { type: "highlight", attrs: { color: "#fff59d" } }]))), null);
  assert.equal(contentWhy(doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: [120] }, content: [{ type: "paragraph" }] }] }] })), null);
});

test("sinkron foto hanya mengubah alamat gambar, idempoten", () => {
  const d = seedDoc("vrv", { src: "/api/file?key=old.jpg", ref: "item:ck1" });
  const r1 = refreshImages(d, (ref) => (ref === "item:ck1" ? "/api/file?key=new.jpg" : null));
  assert.ok(r1.changed);
  assert.equal(plainText(r1.doc), plainText(d));
  assert.match(JSON.stringify(r1.doc), /new\.jpg/);
  const r2 = refreshImages(r1.doc, (ref) => (ref === "item:ck1" ? "/api/file?key=new.jpg" : null));
  assert.equal(r2.changed, false);
  assert.equal(refreshImages(d, () => null).changed, false); // foto hilang: dokumen tidak diubah
});

test("versi riwayat tidak dibuat setiap ketikan", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  assert.equal(needSnapshot(null, "u1", now), true);
  assert.equal(needSnapshot({ byId: "u1", createdAt: new Date("2026-11-22T09:50:00Z") }, "u1", now), false);
  assert.equal(needSnapshot({ byId: "u1", createdAt: new Date("2026-11-22T09:40:00Z") }, "u1", now), true);
  assert.equal(needSnapshot({ byId: "u2", createdAt: new Date("2026-11-22T09:59:00Z") }, "u1", now), true);
});

test("Creative Review: admin/Admin 2 bukan penulis; admin penuh boleh dengan alasan", () => {
  const member = { userId: "m", canManage: false, full: false };
  const a2 = { userId: "a2", canManage: true, full: false };
  const z = { userId: "z", canManage: true, full: true };
  const doc = { status: "review", writers: ["a2", "z"] };
  assert.ok(reviewWhy(member, doc, "approve", "", ""));
  assert.ok(reviewWhy(a2, doc, "approve", "", ""));
  assert.ok(reviewWhy(z, doc, "approve", "", ""));
  assert.equal(reviewWhy(z, doc, "approve", "", "penulis cuti"), null);
  assert.equal(reviewWhy(a2, { status: "review", writers: ["m"] }, "approve", "", ""), null);
  assert.ok(reviewWhy(a2, { status: "review", writers: ["m"] }, "revise", " ", ""));
  assert.equal(reviewWhy(a2, { status: "review", writers: ["m"] }, "revise", "perbaiki hook", ""), null);
  assert.ok(reviewWhy(a2, { status: "draft", writers: [] }, "approve", "", ""));
  assert.equal(submitWhy("draft"), null);
  assert.equal(submitWhy("revision"), null);
  assert.ok(submitWhy("review"));
  assert.equal(statusAfterEdit("approved"), "draft");
  assert.equal(statusAfterEdit("review"), "draft");
  assert.equal(statusAfterEdit("revision"), "revision");
});

test("komentar: selesaikan & buka lagi", () => {
  const m = { userId: "m", canManage: false, full: false }, a = { userId: "a", canManage: true, full: false };
  assert.equal(commentWhy(m, { byId: "m", resolvedAt: null }, "resolve"), null);
  assert.ok(commentWhy(m, { byId: "x", resolvedAt: null }, "resolve"));
  assert.equal(commentWhy(a, { byId: "x", resolvedAt: null }, "resolve"), null);
  assert.ok(commentWhy(m, { byId: "m", resolvedAt: new Date() }, "reopen"));
  assert.equal(commentWhy(a, { byId: "m", resolvedAt: new Date() }, "reopen"), null);
});
