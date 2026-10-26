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
  assert.equal(canWrite(rayhan, "set", "folders/i", null, { color: "blue", updatedAt: 1 }), null);
  assert.notEqual(canWrite(rayhan, "set", "folders/i", null, { color: "blue", foo: 1 }), null);
  // folder buatan sendiri
  const nf = { name: "Campaign Desember", color: "", parent: "", custom: true, owner: rayhan.email, createdAt: 1, updatedAt: 1 };
  assert.equal(canWrite(rayhan, "set", "folders/f1", null, nf), null);
  assert.notEqual(canWrite(rayhan, "set", "folders/f1", null, { ...nf, owner: "lain@x.com" }), null);
  assert.notEqual(canWrite(rayhan, "set", "folders/f1", null, { ...nf, name: "a/b" }), null);
  assert.equal(canWrite(rayhan, "update", "folders/f1", { ...nf, owner: "lain@x.com" }, { ...nf, owner: "lain@x.com", parent: "f2" }), null);
  assert.notEqual(canWrite(rayhan, "delete", "folders/f1", { ...nf, owner: "lain@x.com" }, null), null);
  assert.equal(canWrite(rayhan, "delete", "folders/f1", nf, null), null);
  assert.equal(canWrite(rayhan, "set", "folders/i", null, { color: "", parent: "f1", updatedAt: 1 }), null);
  assert.equal(canRead(rayhan, "uploads/x"), false);
});
