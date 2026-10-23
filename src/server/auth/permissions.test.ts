import { test } from "node:test";
import assert from "node:assert/strict";
import { can } from "./permissions";

const hr = { activeRole: "HR" as const, userId: "hr1" };
const boss = { activeRole: "BOSS" as const, userId: "boss1" };

test("HR tidak boleh memberi role BOSS atau HR", () => {
  assert.equal(can.assignRole(hr, "BOSS", "x"), false);
  assert.equal(can.assignRole(hr, "HR", "x"), false);
});

test("HR boleh memberi role biasa ke orang lain", () => {
  assert.equal(can.assignRole(hr, "SALES", "x"), true);
  assert.equal(can.assignRole(hr, "MEDIA", "x"), true);
});

test("HR tidak boleh ubah role akun sendiri", () => {
  assert.equal(can.assignRole(hr, "SALES", "hr1"), false);
});

test("Boss boleh semua role termasuk ke diri sendiri", () => {
  assert.equal(can.assignRole(boss, "BOSS", "boss1"), true);
  assert.equal(can.assignRole(boss, "HR", "x"), true);
  assert.equal(can.assignRole(boss, "SALES", "x"), true);
});

test("role biasa tidak bisa atur role", () => {
  const sales = { activeRole: "SALES" as const, userId: "s1" };
  assert.equal(can.assignRole(sales, "SALES", "x"), false);
});

test("kelola karyawan hanya BOSS & HR", () => {
  assert.equal(can.manageEmployees("BOSS"), true);
  assert.equal(can.manageEmployees("HR"), true);
  assert.equal(can.manageEmployees("HEAD_BRANCH"), false);
  assert.equal(can.manageEmployees("SALES"), false);
});

test("Head Branch tidak lihat semua absensi (§11.1)", () => {
  assert.equal(can.viewAllAttendance("HEAD_BRANCH"), false);
  assert.equal(can.viewAllAttendance("HR"), true);
});
