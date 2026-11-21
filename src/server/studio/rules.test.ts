import { test } from "node:test";
import assert from "node:assert/strict";
import { canRead, canWrite, type StudioUser } from "./rules";

const base = { userId: "u", name: "x", idcc: false };
const zaki: StudioUser = { ...base, email: "zaki@tirtonichub.com", code: "Z", full: true, staff: true, idcc: true };
const aulia: StudioUser = { ...base, email: "aulia@tirtonichub.com", code: "A", full: false, staff: true, idcc: true };
const rayhan: StudioUser = { ...base, email: "rayhan@tirtonichub.com", code: "R", full: false, staff: false };

test("kalender & catatan pribadi hanya pemiliknya", () => {
  assert.equal(canRead(rayhan, "pcal/rayhan@tirtonichub.com"), true);
  assert.equal(canRead(zaki, "pcal/rayhan@tirtonichub.com"), false);
  assert.notEqual(canWrite(zaki, "set", "pcal/rayhan@tirtonichub.com", null, { color: "lime" }), null);
  assert.equal(canWrite(rayhan, "set", "pcal/rayhan@tirtonichub.com", null, { color: "teal", notes: "x", updatedAt: 1 }), null);
});

test("laporan khusus admin penuh", () => {
  assert.equal(canRead(aulia, "reports/w1"), false);
  assert.equal(canRead(zaki, "reports/w1"), true);
});

test("kode Louis2: Admin 2 hanya mencatat JP dan tidak bisa mengubah kode", () => {
  assert.equal(canWrite(aulia, "set", "items/a", null, { name: "x", tier: "JP" }), null);
  assert.notEqual(canWrite(aulia, "set", "items/a", null, { name: "x", tier: "EX" }), null);
  assert.notEqual(canWrite(aulia, "update", "items/a", { tier: "JP" }, { tier: "EX" }), null);
  assert.equal(canWrite(aulia, "update", "items/a", { tier: "JP", qty: 1 }, { tier: "JP", qty: 3 }), null);
  assert.equal(canWrite(zaki, "update", "items/a", { tier: "JP" }, { tier: "EX" }), null);
});

test("anggota hanya memindahkan kartunya sendiri sampai Ready", () => {
  const card = { producer: "R", editor: "Z", status: "Terdata", title: "x" };
  assert.equal(canWrite(rayhan, "update", "tasks/t", card, { ...card, status: "Diproduksi", updatedAt: 2 }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", card, { ...card, status: "Tayang" }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", card, { ...card, title: "ganti" }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", { ...card, producer: "A" }, { ...card, producer: "A", status: "Editing" }), null);
  assert.notEqual(canWrite(rayhan, "delete", "tasks/t", card, null), null);
});

test("profil sendiri: hanya avatar", () => {
  const me = { name: "Rayhan", role: "member", avColor: "lime" };
  assert.equal(canWrite(rayhan, "update", "members/rayhan@tirtonichub.com", me, { ...me, avColor: "pink", avAnimal: "cat" }), null);
  assert.notEqual(canWrite(rayhan, "update", "members/rayhan@tirtonichub.com", me, { ...me, role: "admin" }), null);
});

test("file hasil konten: hapus oleh admin atau pengunggah saja", () => {
  const f = { itemId: "i", name: "a.jpg", uploaderId: "u-rayhan" };
  assert.equal(canRead(rayhan, "assets/x"), true);
  assert.equal(canWrite(aulia, "delete", "assets/x", f, null), null);
  assert.equal(canWrite({ ...rayhan, userId: "u-rayhan" }, "delete", "assets/x", f, null), null);
  assert.notEqual(canWrite({ ...rayhan, userId: "u-lain" }, "delete", "assets/x", f, null), null);
  assert.notEqual(canWrite(zaki, "set", "assets/x", null, f), null);
});

test("File Konten: semua anggota boleh ganti nama/warna, folder berwarna", () => {
  const f = { itemId: "i", name: "a.mp4", color: "", section: "vpr", uploaderId: "u-zaki", url: "/x" };
  assert.equal(canWrite(rayhan, "update", "assets/x", f, { ...f, name: "b.mp4", color: "red" }), null);
  assert.notEqual(canWrite(rayhan, "update", "assets/x", f, { ...f, url: "/lain" }), null);
  assert.notEqual(canWrite(rayhan, "update", "assets/x", f, { ...f, color: "pink" }), null);
  // folder barang & kategori: hanya admin/Admin 2
  assert.notEqual(canWrite(rayhan, "set", "folders/i", null, { color: "blue", updatedAt: 1 }), null);
  assert.equal(canWrite(aulia, "set", "folders/i", null, { color: "blue", updatedAt: 1 }), null);
  assert.notEqual(canWrite(aulia, "set", "folders/i", null, { color: "blue", foo: 1 }), null);
  assert.equal(canWrite(aulia, "set", "folders/cat:sepatu", null, { color: "", share: { all: false, codes: ["R", "S"] }, updatedAt: 1 }), null);
  assert.notEqual(canWrite(aulia, "set", "folders/cat:sepatu", null, { color: "", share: { codes: ["X"] }, updatedAt: 1 }), null);
  // catatan (Docs)
  const nd = { title: "Ide konten", body: "isi", parent: "", color: "", owner: rayhan.email, createdAt: 1, updatedAt: 1, updatedBy: "Rayhan" };
  assert.equal(canRead(rayhan, "docs/d1"), true);
  assert.equal(canWrite(rayhan, "set", "docs/d1", null, nd), null);
  assert.notEqual(canWrite(rayhan, "set", "docs/d1", null, { ...nd, owner: "x@y.com" }), null);
  assert.equal(canWrite(rayhan, "update", "docs/d1", { ...nd, owner: "x@y.com" }, { ...nd, owner: "x@y.com", body: "ubah" }), null);
  assert.notEqual(canWrite(rayhan, "delete", "docs/d1", { ...nd, owner: "x@y.com" }, null), null);
  // folder buatan sendiri
  const nf = { name: "Campaign Desember", color: "", parent: "", custom: true, owner: rayhan.email, createdAt: 1, updatedAt: 1 };
  assert.equal(canWrite(rayhan, "set", "folders/f1", null, nf), null);
  assert.notEqual(canWrite(rayhan, "set", "folders/f1", null, { ...nf, owner: "lain@x.com" }), null);
  assert.notEqual(canWrite(rayhan, "set", "folders/f1", null, { ...nf, name: "a/b" }), null);
  assert.equal(canWrite(rayhan, "update", "folders/f1", { ...nf, owner: "lain@x.com" }, { ...nf, owner: "lain@x.com", parent: "f2" }), null);
  assert.notEqual(canWrite(rayhan, "update", "folders/f1", { ...nf, owner: "lain@x.com" }, { ...nf, owner: "lain@x.com", share: { all: true } }), null);
  assert.equal(canWrite(rayhan, "update", "folders/f1", nf, { ...nf, share: { all: false, codes: ["A"] } }), null);
  // akses cepat Beranda
  assert.equal(canRead(rayhan, "pins/" + rayhan.email), true);
  assert.equal(canRead(rayhan, "pins/" + zaki.email), false);
  assert.equal(canWrite(rayhan, "set", "pins/" + rayhan.email, null, { items: [{ t: "f", id: "f1" }], updatedAt: 1 }), null);
  assert.notEqual(canWrite(rayhan, "set", "pins/" + zaki.email, null, { items: [], updatedAt: 1 }), null);
  assert.notEqual(canWrite(rayhan, "delete", "folders/f1", { ...nf, owner: "lain@x.com" }, null), null);
  assert.equal(canWrite(rayhan, "delete", "folders/f1", nf, null), null);
  assert.equal(canRead(rayhan, "uploads/x"), false);
});

test("Foto katalog boleh masuk Ready tanpa link", () => {
  const ktl = { type: "ktl", status: "Editing", producer: "R", editor: "R", driveUrl: "" };
  assert.equal(canWrite(zaki, "update", "tasks/k", ktl, { ...ktl, status: "Ready" }), null);
  assert.equal(canWrite(rayhan, "update", "tasks/k", ktl, { ...ktl, status: "Ready" }), null);
});

test("tanda notifikasi Foto katalog hanya diisi server", () => {
  const k = { type: "ktl", status: "Tayang", ktlNotifErr: 5 };
  assert.notEqual(canWrite(zaki, "update", "tasks/k", k, { ...k, ktlNotifErr: null }), null);
  assert.notEqual(canWrite(zaki, "set", "tasks/n", null, { type: "ktl", status: "Terdata", ktlNotifAt: 1 }), null);
  assert.equal(canWrite(zaki, "update", "tasks/k", k, { ...k, note: "x" }), null);
});

test("tangguhkan konten hanya admin penuh", () => {
  const k = { type: "vrv", status: "Terdata", producer: "R", editor: "A" };
  const sus = { ...k, suspendedAt: 123, suspendedBy: "Zaki" };
  assert.equal(canWrite(zaki, "update", "tasks/k", k, sus), null);
  assert.equal(canWrite(zaki, "update", "tasks/k", sus, { ...k, suspendedAt: null, suspendedBy: "", pausedMs: 5 }), null);
  assert.notEqual(canWrite(aulia, "update", "tasks/k", k, sus), null);
  assert.notEqual(canWrite(aulia, "update", "tasks/k", sus, { ...k, suspendedAt: null }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/k", k, sus), null);
  assert.notEqual(canWrite(aulia, "set", "tasks/n", null, sus), null);
  assert.equal(canWrite(aulia, "update", "tasks/k", sus, { ...sus, note: "x" }), null);
});

test("link skrip: anggota kartu boleh, hanya Google Docs", () => {
  const k = { type: "vrv", status: "Terdata", producer: "R", editor: "R" };
  const url = "https://docs.google.com/document/d/abc/edit?tab=t.1";
  assert.equal(canWrite(rayhan, "update", "tasks/k", k, { ...k, scriptUrl: url }), null);
  assert.equal(canWrite(zaki, "update", "tasks/k", k, { ...k, scriptUrl: url }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/k", k, { ...k, scriptUrl: "https://contoh.com/x" }), null);
  assert.notEqual(canWrite(zaki, "update", "tasks/k", k, { ...k, scriptUrl: "javascript:alert(1)" }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/k", { ...k, producer: "A", editor: "A" }, { ...k, producer: "A", editor: "A", scriptUrl: url }), null);
});

test("sakelar WA Foto katalog hanya admin penuh", () => {
  assert.notEqual(canWrite(aulia, "update", "settings/main", { idccDay: 3 }, { idccDay: 3, katalogWa: true }), null);
  assert.equal(canWrite(aulia, "update", "settings/main", { idccDay: 3, katalogWa: true }, { idccDay: 4, katalogWa: true }), null);
  assert.equal(canWrite(zaki, "update", "settings/main", { idccDay: 3 }, { idccDay: 3, katalogWa: true }), null);
  assert.notEqual(canWrite(rayhan, "update", "settings/main", {}, { idccDay: 4 }), null);
  assert.notEqual(canWrite(aulia, "update", "settings/main", { katalogTo: ["a@x.com"] }, { katalogTo: ["b@x.com"] }), null);
  assert.equal(canWrite(zaki, "update", "settings/main", { katalogTo: ["a@x.com"] }, { katalogTo: ["b@x.com"] }), null);
});

test("tanggal produksi/edit & Deadline Ready kartu lama: hanya admin penuh", () => {
  const t = { status: "Terdata", producer: "A", shootPlan: "2026-11-12", editPlan: "2026-11-13", readyBy: "2026-11-14", due: "2026-11-14" };
  assert.equal(canWrite(zaki, "update", "tasks/t1", t, { ...t, shootPlan: "2026-11-15" }), null);
  assert.notEqual(canWrite(aulia, "update", "tasks/t1", t, { ...t, shootPlan: "2026-11-15" }), null);
  assert.notEqual(canWrite(aulia, "update", "tasks/t1", t, { ...t, readyBy: "2026-11-20", due: "2026-11-20" }), null);
  assert.equal(canWrite(aulia, "update", "tasks/t1", t, { ...t, postAt: "2026-11-20" }), null);
  assert.equal(canWrite(aulia, "set", "tasks/t2", null, { ...t }), null);
});

test("gabungkan Video review: hanya admin penuh", () => {
  const t = { type: "vrv", status: "Terdata", producer: "A" };
  assert.equal(canWrite(zaki, "update", "tasks/t1", t, { ...t, mergedInto: "t9" }), null);
  assert.notEqual(canWrite(aulia, "update", "tasks/t1", t, { ...t, mergedInto: "t9" }), null);
});

test("isian CPR Detail kartu: format dijaga, anggota hanya hook & CTA", () => {
  const card = { producer: "R", editor: "Z", status: "Editing", title: "x" };
  assert.equal(canWrite(zaki, "update", "tasks/t", card, { ...card, objective: "AWR", campaignId: "CMP-PYD-2611", productSku: "SKU-1", reviewer: "A", platform: "TikTok", postUrl: "https://instagram.com/p/x" }), null);
  assert.notEqual(canWrite(zaki, "update", "tasks/t", card, { ...card, campaignId: "TRT-CMP-PYD-2611" }), null);
  assert.notEqual(canWrite(zaki, "update", "tasks/t", card, { ...card, objective: "XYZ" }), null);
  assert.notEqual(canWrite(zaki, "update", "tasks/t", card, { ...card, postUrl: "http://x" }), null);
  assert.notEqual(canWrite(zaki, "update", "tasks/t", card, { ...card, reviewer: "Q" }), null);
  assert.equal(canWrite(rayhan, "update", "tasks/t", card, { ...card, hook: "ide", cta: "DM kami", updatedAt: 2 }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", card, { ...card, campaignId: "TRT-CMP-1" }), null);
});

test("tab CPR: hanya admin penuh, inquiry/order unik, bukti wajib", () => {
  assert.equal(canRead(zaki, "cpr/o_x"), true);
  assert.equal(canRead(aulia, "cpr/o_x"), false);
  const ord = { orderId: "INV-1", date: "2026-11-21", kind: "Direct", amount: 350000, taskId: "t1", campaignId: "", evidence: "kode promo REV11", note: "", by: "Zaki", at: 1 };
  assert.equal(canWrite(zaki, "set", "cpr/o_inv-1", null, ord), null);
  assert.notEqual(canWrite(aulia, "set", "cpr/o_inv-1", null, ord), null);
  assert.notEqual(canWrite(zaki, "set", "cpr/o_inv-1", ord, ord), null); // Order ID sama
  assert.notEqual(canWrite(zaki, "set", "cpr/o_inv-2", null, { ...ord, evidence: "" }), null);
  assert.equal(canWrite(zaki, "set", "cpr/o_inv-3", null, { ...ord, kind: "Unknown", evidence: "", taskId: "" }), null);
  assert.notEqual(canWrite(zaki, "set", "cpr/o_inv-4", null, { ...ord, amount: -5 }), null);
  const inq = { ref: "WA-1", date: "2026-11-21", kind: "Direct", intent: "ukuran", taskId: "t1", campaignId: "", evidence: "chat CS", by: "Zaki", at: 1 };
  assert.equal(canWrite(zaki, "set", "cpr/q_wa-1", null, inq), null);
  assert.notEqual(canWrite(zaki, "set", "cpr/q_wa-1", inq, inq), null);
  assert.notEqual(canWrite(zaki, "set", "cpr/q_wa-2", null, { ...inq, intent: "like" }), null);
  const snap = { taskId: "t1", cp: "D+7", reach: 5000, views: null, likes: 200, comments: 10, saves: 40, shares: 5, profileVisits: null, source: "IG Insights", observedAt: 1, by: "Zaki", at: 1 };
  assert.equal(canWrite(zaki, "set", "cpr/s_t1_7", null, snap), null);
  assert.equal(canWrite(zaki, "set", "cpr/s_t1_7", snap, { ...snap, reach: 6000 }), null);
  assert.notEqual(canWrite(zaki, "set", "cpr/s_t1_1", null, snap), null); // alamat tidak cocok
  assert.notEqual(canWrite(zaki, "set", "cpr/s_t1_7", null, { ...snap, source: "" }), null);
  const act = { insight: "save rate tinggi", action: "buat 2 review lagi", owner: "A", due: "2026-11-28", status: "Open", taskId: "", by: "Zaki", at: 1 };
  assert.equal(canWrite(zaki, "set", "cpr/a_1", null, act), null);
  assert.notEqual(canWrite(zaki, "set", "cpr/a_1", null, { ...act, status: "Selesai" }), null);
  assert.equal(canWrite(zaki, "delete", "cpr/o_inv-1", ord, null), null);
});

test("anggota boleh mengisi isian CPR di kartunya, bukan Reviewer", () => {
  const card = { producer: "R", editor: "Z", status: "Editing", title: "x" };
  assert.equal(canWrite(rayhan, "update", "tasks/t", card, { ...card, objective: "ENG", campaignId: "CMP-PYD-2611", productSku: "S1", platform: "TikTok", postUrl: "https://x.com/p" }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", card, { ...card, reviewer: "A" }), null);
});
