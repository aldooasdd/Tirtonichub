import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_CODES, roleAttends, HR_ROLES } from "./roles";
import { navForRole, bottomNavForRole } from "./nav";

const labels = (role: Parameters<typeof navForRole>[0]) =>
  navForRole(role).flatMap((g) => g.items.map((i) => i.label));

test("ada tepat 8 role", () => {
  assert.equal(ROLE_CODES.length, 8);
});

test("Boss tidak absen, role lain absen", () => {
  assert.equal(roleAttends("BOSS"), false);
  assert.equal(roleAttends("HR"), true);
  assert.equal(roleAttends("SALES"), true);
});

test("hanya BOSS & HR punya modul HR", () => {
  assert.deepEqual([...HR_ROLES].sort(), ["BOSS", "HR"]);
  assert.ok(navForRole("HR").some((g) => g.title === "HR"));
  assert.ok(navForRole("BOSS").some((g) => g.title === "HR"));
  assert.ok(!navForRole("SALES").some((g) => g.title === "HR"));
});

test("menu Absen ikut kewajiban absen", () => {
  assert.ok(!labels("BOSS").includes("Absen"));
  assert.ok(labels("HR").includes("Absen"));
  assert.ok(labels("SALES").includes("Absen"));
});

test("bottom nav HP: Boss tanpa Absen, Sales dengan Absen", () => {
  const boss = bottomNavForRole("BOSS").map((i) => i.label);
  const sales = bottomNavForRole("SALES").map((i) => i.label);
  assert.ok(!boss.includes("Absen"));
  assert.ok(sales.includes("Absen"));
  assert.equal(sales.length, 5);
});
